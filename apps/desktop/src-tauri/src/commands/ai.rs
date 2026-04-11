#![allow(non_snake_case)]

use std::collections::HashSet;

use rusqlite::params;
use serde::Deserialize;
use tauri::State;
use ulid::Ulid;

use crate::{
    ai::{generate_bookmark_ai_suggestions, BookmarkAiInput},
    db::{DatabaseState, DbError},
};

use super::bookmarks::{
    get_bookmark, list_categories, update_bookmark_with_writer, BookmarkRecordDto, TagInputDto, UpdateBookmarkPatchDto,
};
use crate::sync::SyncWriterKind;

const AI_STATUS_RUNNING: &str = "running";
const AI_STATUS_READY: &str = "ready";
const AI_STATUS_FAILED: &str = "failed";
const AI_FIELD_DESCRIPTION: &str = "description";
const AI_FIELD_PRIMARY_CATEGORY_ID: &str = "primaryCategoryId";
const AI_FIELD_TAGS: &str = "tags";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyAiSuggestionsInputDto {
    pub apply_untouched: bool,
    pub replace_fields: Vec<String>,
}

#[tauri::command]
pub async fn desktop_queue_ai_enrichment(
    state: State<'_, DatabaseState>,
    bookmarkId: String,
) -> Result<BookmarkRecordDto, String> {
    process_ai_enrichment(state, bookmarkId).await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn desktop_retry_ai_enrichment(
    state: State<'_, DatabaseState>,
    bookmarkId: String,
) -> Result<BookmarkRecordDto, String> {
    process_ai_enrichment(state, bookmarkId).await.map_err(|error| error.to_string())
}

#[tauri::command]
pub fn desktop_apply_ai_suggestions(
    state: State<'_, DatabaseState>,
    bookmarkId: String,
    input: ApplyAiSuggestionsInputDto,
) -> Result<BookmarkRecordDto, String> {
    let mut connection = state.open_connection().map_err(to_command_error)?;
    let transaction = connection
        .transaction()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    let bookmark = apply_ai_suggestions(&transaction, &bookmarkId, input).map_err(to_command_error)?;
    transaction
        .commit()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    Ok(bookmark)
}

async fn process_ai_enrichment(
    state: State<'_, DatabaseState>,
    bookmark_id: String,
) -> Result<BookmarkRecordDto, DbError> {
    let (current_bookmark, categories, run_id) = {
        let connection = state.open_connection()?;
        let bookmark = get_bookmark(&connection, &bookmark_id)?
            .ok_or_else(|| DbError::BookmarkNotFound(bookmark_id.clone()))?;

        if bookmark.processing_status != "ready" || bookmark.deleted_at.is_some() {
            return Ok(bookmark);
        }

        let categories = list_categories(&connection)?;
        let run_id = Ulid::new().to_string();
        set_ai_suggestion_running(&connection, &bookmark_id, &run_id)?;
        (bookmark, categories, run_id)
    };

    let ai_input = BookmarkAiInput {
        url: current_bookmark.url.clone(),
        title: current_bookmark.title.clone(),
        description_excerpt: current_bookmark.description_excerpt.clone(),
        description: current_bookmark.description.clone(),
        categories,
    };

    match generate_bookmark_ai_suggestions(ai_input).await {
        Ok(draft) => {
            let connection = state.open_connection()?;

            if is_stale_run(&connection, &bookmark_id, &run_id)? {
                return get_bookmark(&connection, &bookmark_id)?
                    .ok_or_else(|| DbError::BookmarkNotFound(bookmark_id.clone()));
            }

            connection.execute(
                "
                UPDATE bookmark_ai_suggestions
                SET status = ?2,
                    proposed_primary_category_id = ?3,
                    proposed_description = ?4,
                    proposed_tags_json = ?5,
                    last_error = NULL,
                    generated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE bookmark_id = ?1
                  AND run_id = ?6
                ",
                params![
                    bookmark_id.as_str(),
                    AI_STATUS_READY,
                    draft.proposed_primary_category_id,
                    draft.proposed_description,
                    serde_json::to_string(&draft.proposed_tags)?,
                    run_id.as_str(),
                ],
            )?;

            get_bookmark(&connection, &bookmark_id)?
                .ok_or_else(|| DbError::BookmarkNotFound(bookmark_id.clone()))
        }
        Err(error) => {
            let connection = state.open_connection()?;

            if is_stale_run(&connection, &bookmark_id, &run_id)? {
                return get_bookmark(&connection, &bookmark_id)?
                    .ok_or_else(|| DbError::BookmarkNotFound(bookmark_id.clone()));
            }

            connection.execute(
                "
                UPDATE bookmark_ai_suggestions
                SET status = ?2,
                    last_error = ?3,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE bookmark_id = ?1
                  AND run_id = ?4
                ",
                params![bookmark_id.as_str(), AI_STATUS_FAILED, error, run_id.as_str()],
            )?;

            get_bookmark(&connection, &bookmark_id)?
                .ok_or_else(|| DbError::BookmarkNotFound(bookmark_id.clone()))
        }
    }
}

fn apply_ai_suggestions(
    connection: &rusqlite::Connection,
    bookmark_id: &str,
    input: ApplyAiSuggestionsInputDto,
) -> Result<BookmarkRecordDto, DbError> {
    let current_bookmark = get_bookmark(connection, bookmark_id)?
        .ok_or_else(|| DbError::BookmarkNotFound(bookmark_id.to_string()))?;
    let ai_suggestion = if let Some(ai_suggestion) = current_bookmark.ai_suggestion.clone() {
        ai_suggestion
    } else {
        return Ok(current_bookmark);
    };

    if ai_suggestion.status != AI_STATUS_READY {
        return Ok(current_bookmark);
    }

    let protected_fields = current_bookmark
        .user_edited_mask
        .iter()
        .map(|field| field.as_str())
        .collect::<HashSet<_>>();
    let final_apply_set = compute_ai_apply_fields(
        input.apply_untouched,
        &input.replace_fields,
        &protected_fields,
    );

    let mut patch = UpdateBookmarkPatchDto {
        url: None,
        title: None,
        description: None,
        favicon: None,
        cover_url: None,
        primary_category_id: None,
        is_starred: None,
        processing_status: None,
        processing_error: None,
        user_edited_mask: Some(current_bookmark.user_edited_mask.clone()),
        tags: None,
        collection_ids: None,
        deleted_at: None,
    };

    if final_apply_set.contains(AI_FIELD_DESCRIPTION) && ai_suggestion.proposed_description.is_some() {
        patch.description = Some(ai_suggestion.proposed_description.clone());
    }

    if final_apply_set.contains(AI_FIELD_PRIMARY_CATEGORY_ID) && ai_suggestion.proposed_primary_category_id.is_some() {
        patch.primary_category_id = Some(ai_suggestion.proposed_primary_category_id.clone());
    }

    if final_apply_set.contains(AI_FIELD_TAGS) && !ai_suggestion.proposed_tags.is_empty() {
        patch.tags = Some(
            ai_suggestion
                .proposed_tags
                .iter()
                .map(|tag| TagInputDto {
                    id: None,
                    label: tag.clone(),
                    color: None,
                })
                .collect(),
        );
    }

    if patch.description.is_none() && patch.primary_category_id.is_none() && patch.tags.is_none() {
        return Ok(current_bookmark);
    }

    update_bookmark_with_writer(connection, bookmark_id, patch, SyncWriterKind::Ai)
}

fn set_ai_suggestion_running(
    connection: &rusqlite::Connection,
    bookmark_id: &str,
    run_id: &str,
) -> Result<(), DbError> {
    connection.execute(
        "
        INSERT INTO bookmark_ai_suggestions (
          bookmark_id,
          run_id,
          status,
          proposed_tags_json,
          last_error
        ) VALUES (?1, ?2, ?3, '[]', NULL)
        ON CONFLICT(bookmark_id) DO UPDATE SET
          run_id = excluded.run_id,
          status = excluded.status,
          last_error = NULL,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        ",
        params![bookmark_id, run_id, AI_STATUS_RUNNING],
    )?;

    Ok(())
}

fn is_stale_run(
    connection: &rusqlite::Connection,
    bookmark_id: &str,
    run_id: &str,
) -> Result<bool, DbError> {
    let persisted_run_id = connection.query_row(
        "SELECT run_id FROM bookmark_ai_suggestions WHERE bookmark_id = ?1",
        [bookmark_id],
        |row| row.get::<_, String>(0),
    )?;

    Ok(persisted_run_id != run_id)
}

fn compute_ai_apply_fields(
    apply_untouched: bool,
    replace_fields: &[String],
    protected_fields: &HashSet<&str>,
) -> HashSet<&'static str> {
    let mut fields = HashSet::new();

    if apply_untouched {
        for field in [AI_FIELD_PRIMARY_CATEGORY_ID, AI_FIELD_TAGS, AI_FIELD_DESCRIPTION] {
            if !protected_fields.contains(field) {
                fields.insert(field);
            }
        }
    }

    for field in replace_fields {
        match field.as_str() {
            AI_FIELD_PRIMARY_CATEGORY_ID | AI_FIELD_TAGS | AI_FIELD_DESCRIPTION if protected_fields.contains(field.as_str()) => {
                fields.insert(match field.as_str() {
                    AI_FIELD_PRIMARY_CATEGORY_ID => AI_FIELD_PRIMARY_CATEGORY_ID,
                    AI_FIELD_TAGS => AI_FIELD_TAGS,
                    AI_FIELD_DESCRIPTION => AI_FIELD_DESCRIPTION,
                    _ => unreachable!(),
                });
            }
            _ => {}
        }
    }

    fields
}

fn to_command_error(error: DbError) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::{compute_ai_apply_fields, is_stale_run, AI_FIELD_DESCRIPTION, AI_FIELD_PRIMARY_CATEGORY_ID, AI_FIELD_TAGS};
    use crate::db::DbError;
    use rusqlite::Connection;

    #[test]
    fn compute_ai_apply_fields_keeps_protected_fields_out_of_apply_untouched() {
        let protected_fields = HashSet::from([AI_FIELD_DESCRIPTION]);
        let result = compute_ai_apply_fields(true, &[], &protected_fields);

        assert!(result.contains(AI_FIELD_PRIMARY_CATEGORY_ID));
        assert!(result.contains(AI_FIELD_TAGS));
        assert!(!result.contains(AI_FIELD_DESCRIPTION));
    }

    #[test]
    fn compute_ai_apply_fields_allows_explicit_replace_for_protected_field() {
        let protected_fields = HashSet::from([AI_FIELD_DESCRIPTION]);
        let result = compute_ai_apply_fields(false, &[AI_FIELD_DESCRIPTION.to_string()], &protected_fields);

        assert!(result.contains(AI_FIELD_DESCRIPTION));
    }

    #[test]
    fn is_stale_run_returns_true_when_persisted_run_differs() -> Result<(), DbError> {
        let connection = Connection::open_in_memory().map_err(DbError::from)?;
        connection.execute_batch(
            "
            CREATE TABLE bookmark_ai_suggestions (
              bookmark_id TEXT PRIMARY KEY,
              run_id TEXT NOT NULL,
              status TEXT NOT NULL,
              proposed_primary_category_id TEXT,
              proposed_description TEXT,
              proposed_tags_json TEXT NOT NULL DEFAULT '[]',
              last_error TEXT,
              generated_at TEXT,
              updated_at TEXT NOT NULL
            );
            INSERT INTO bookmark_ai_suggestions (bookmark_id, run_id, status, updated_at)
            VALUES ('bookmark-1', 'run-latest', 'ready', '2026-04-09T00:00:00.000Z');
            ",
        )?;

        assert!(is_stale_run(&connection, "bookmark-1", "run-older")?);
        assert!(!is_stale_run(&connection, "bookmark-1", "run-latest")?);
        Ok(())
    }
}
