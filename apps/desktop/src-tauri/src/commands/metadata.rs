#![allow(non_snake_case)]

use rusqlite::params;
use tauri::State;

use crate::{
    db::{DatabaseState, DbError},
    metadata::extract_metadata,
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
        let connection = state.open_connection()?;
        let url = connection.query_row(
            "SELECT url FROM bookmarks WHERE id = ?1",
            [bookmark_id.as_str()],
            |row| row.get::<_, String>(0),
        )?;
        connection.execute(
            "
            UPDATE bookmarks
            SET processing_status = 'processing',
                processing_error = NULL,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?1
            ",
            [bookmark_id.as_str()],
        )?;
        url
    };

    match extract_metadata(&bookmark_url).await {
        Ok(metadata) => {
            let connection = state.open_connection()?;
            connection.execute(
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

            get_bookmark(&connection, bookmark_id.as_str())?
                .ok_or(DbError::BookmarkNotFound(bookmark_id))
        }
        Err(error) => {
            let connection = state.open_connection()?;
            connection.execute(
                "
                UPDATE bookmarks
                SET processing_status = 'failed',
                    processing_error = ?2,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE id = ?1
                ",
                params![bookmark_id.as_str(), error.to_string()],
            )?;

            get_bookmark(&connection, bookmark_id.as_str())?
                .ok_or(DbError::BookmarkNotFound(bookmark_id))
        }
    }
}
