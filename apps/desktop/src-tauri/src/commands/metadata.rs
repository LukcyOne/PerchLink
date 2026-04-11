#![allow(non_snake_case)]

use rusqlite::params;
use tauri::State;

use crate::{
    db::{DatabaseState, DbError},
    metadata::extract_metadata,
    sync::{enqueue_bookmark_sync_change, sync_operation_upsert, SyncWriterKind},
};

use super::bookmarks::{get_bookmark, BookmarkRecordDto};

#[tauri::command]
pub async fn desktop_queue_metadata_extraction(
    state: State<'_, DatabaseState>,
    bookmarkId: String,
) -> Result<BookmarkRecordDto, String> {
    process_metadata(state, bookmarkId).await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn desktop_retry_metadata_extraction(
    state: State<'_, DatabaseState>,
    bookmarkId: String,
) -> Result<BookmarkRecordDto, String> {
    process_metadata(state, bookmarkId).await.map_err(|error| error.to_string())
}

async fn process_metadata(
    state: State<'_, DatabaseState>,
    bookmark_id: String,
) -> Result<BookmarkRecordDto, DbError> {
    let bookmark_url = {
        let mut connection = state.open_connection()?;
        let transaction = connection.transaction()?;
        let url = transaction.query_row(
            "SELECT url FROM bookmarks WHERE id = ?1",
            [bookmark_id.as_str()],
            |row| row.get::<_, String>(0),
        )?;
        transaction.execute(
            "
            UPDATE bookmarks
            SET processing_status = 'processing',
                processing_error = NULL,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?1
            ",
            [bookmark_id.as_str()],
        )?;
        enqueue_bookmark_sync_change(
            &transaction,
            bookmark_id.as_str(),
            sync_operation_upsert(),
            SyncWriterKind::System,
            &["processingStatus", "processingError"],
        )?;
        transaction.commit()?;
        url
    };

    match extract_metadata(&bookmark_url).await {
        Ok(metadata) => {
            let mut connection = state.open_connection()?;
            let transaction = connection.transaction()?;
            let current_bookmark = get_bookmark(&transaction, bookmark_id.as_str())?
                .ok_or(DbError::BookmarkNotFound(bookmark_id.clone()))?;
            let should_replace_title =
                current_bookmark.user_edited_mask.iter().all(|field| field != "title")
                    || current_bookmark.title.is_empty()
                    || current_bookmark.title == current_bookmark.url;
            transaction.execute(
                "
                UPDATE bookmarks
                SET title = CASE
                      WHEN title = url OR title = '' THEN COALESCE(?2, title)
                      ELSE title
                    END,
                    description = CASE
                      WHEN description IS NULL OR TRIM(description) = '' THEN COALESCE(?3, description)
                      ELSE description
                    END,
                    favicon = COALESCE(?4, favicon),
                    cover_url = COALESCE(?5, cover_url),
                    processing_status = 'ready',
                    processing_error = NULL,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE id = ?1
                ",
                params![
                    bookmark_id.as_str(),
                    metadata.title,
                    metadata.description_excerpt,
                    metadata.favicon,
                    metadata.cover_url,
                ],
            )?;
            let mut changed_fields = vec!["description", "favicon", "coverUrl", "processingStatus", "processingError"];
            if should_replace_title {
                changed_fields.push("title");
            }
            enqueue_bookmark_sync_change(
                &transaction,
                bookmark_id.as_str(),
                sync_operation_upsert(),
                SyncWriterKind::System,
                &changed_fields,
            )?;
            let bookmark = get_bookmark(&transaction, bookmark_id.as_str())?
                .ok_or(DbError::BookmarkNotFound(bookmark_id.clone()))?;
            transaction.commit()?;
            Ok(bookmark)
        }
        Err(error) => {
            let mut connection = state.open_connection()?;
            let transaction = connection.transaction()?;
            transaction.execute(
                "
                UPDATE bookmarks
                SET processing_status = 'failed',
                    processing_error = ?2,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE id = ?1
                ",
                params![bookmark_id.as_str(), error.to_string()],
            )?;
            enqueue_bookmark_sync_change(
                &transaction,
                bookmark_id.as_str(),
                sync_operation_upsert(),
                SyncWriterKind::System,
                &["processingStatus", "processingError"],
            )?;
            let bookmark = get_bookmark(&transaction, bookmark_id.as_str())?
                .ok_or(DbError::BookmarkNotFound(bookmark_id.clone()))?;
            transaction.commit()?;
            Ok(bookmark)
        }
    }
}
