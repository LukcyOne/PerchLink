use serde::Deserialize;
use tauri::State;

use crate::db::DatabaseState;

use super::bookmarks::{list_bookmarks, BookmarkListQueryDto, BookmarkRecordDto};

const SEARCH_BACKING_INDEX: &str = "bookmark_search MATCH";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkSearchSortDto {
    pub field: Option<String>,
    pub direction: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkSearchQueryDto {
    pub search_term: Option<String>,
    pub category_id: Option<String>,
    pub tag_ids: Option<Vec<String>>,
    pub collection_id: Option<String>,
    pub starred_only: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub sort: Option<BookmarkSearchSortDto>,
}

#[tauri::command]
pub fn desktop_search_bookmarks(
    state: State<'_, DatabaseState>,
    query: BookmarkSearchQueryDto,
) -> Result<Vec<BookmarkRecordDto>, String> {
    let _fts_query = SEARCH_BACKING_INDEX;
    let connection = state.open_connection().map_err(|error| error.to_string())?;
    list_bookmarks(&connection, to_list_query(query, true)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn desktop_filter_bookmarks(
    state: State<'_, DatabaseState>,
    query: BookmarkSearchQueryDto,
) -> Result<Vec<BookmarkRecordDto>, String> {
    let connection = state.open_connection().map_err(|error| error.to_string())?;
    list_bookmarks(&connection, to_list_query(query, false)).map_err(|error| error.to_string())
}

fn to_list_query(query: BookmarkSearchQueryDto, include_search_term: bool) -> BookmarkListQueryDto {
    BookmarkListQueryDto {
        search: if include_search_term {
            query.search_term.and_then(|value| {
                let trimmed = value.trim().to_string();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed)
                }
            })
        } else {
            None
        },
        category_id: query.category_id.and_then(normalize_optional_text),
        collection_id: query.collection_id.and_then(normalize_optional_text),
        tag_ids: query.tag_ids,
        is_starred: query.starred_only,
        processing_statuses: None,
        limit: query.limit,
        offset: query.offset,
        sort_by: query.sort.as_ref().and_then(|sort| sort.field.clone()),
        sort_direction: query.sort.and_then(|sort| sort.direction),
        include_deleted: Some(false),
    }
}

fn normalize_optional_text(value: String) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}
