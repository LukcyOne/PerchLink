#![allow(non_snake_case)]

use rusqlite::{params, params_from_iter, types::Value, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;
use ulid::Ulid;

use crate::db::{DatabaseState, DbError};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagInputDto {
    pub id: Option<String>,
    pub label: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagRecordDto {
    pub id: String,
    pub label: String,
    pub color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionRecordDto {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: i64,
    pub bookmark_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTreeNodeDto {
    pub id: String,
    pub name: String,
    pub slug: Option<String>,
    pub parent_id: Option<String>,
    pub sort_order: i64,
    pub is_system: bool,
    pub bookmark_count: i64,
    pub created_at: String,
    pub updated_at: String,
    pub children: Vec<CategoryTreeNodeDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkRecordDto {
    pub id: String,
    pub url: String,
    pub normalized_url: String,
    pub title: String,
    pub description: Option<String>,
    pub description_excerpt: Option<String>,
    pub favicon: Option<String>,
    pub cover_url: Option<String>,
    pub primary_category_id: Option<String>,
    pub tags: Vec<TagRecordDto>,
    pub collection_ids: Vec<String>,
    pub is_starred: bool,
    pub processing_status: String,
    pub processing_error: Option<String>,
    pub user_edited_mask: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBookmarkInputDto {
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub favicon: Option<String>,
    pub cover_url: Option<String>,
    pub primary_category_id: Option<String>,
    pub is_starred: Option<bool>,
    pub processing_status: Option<String>,
    pub processing_error: Option<String>,
    pub user_edited_mask: Option<Vec<String>>,
    pub tags: Option<Vec<TagInputDto>>,
    pub collection_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBookmarkPatchDto {
    pub url: Option<String>,
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<Option<String>>,
    #[serde(default)]
    pub favicon: Option<Option<String>>,
    #[serde(default)]
    pub cover_url: Option<Option<String>>,
    #[serde(default)]
    pub primary_category_id: Option<Option<String>>,
    pub is_starred: Option<bool>,
    pub processing_status: Option<String>,
    #[serde(default)]
    pub processing_error: Option<Option<String>>,
    pub user_edited_mask: Option<Vec<String>>,
    pub tags: Option<Vec<TagInputDto>>,
    pub collection_ids: Option<Vec<String>>,
    #[serde(default)]
    pub deleted_at: Option<Option<String>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkListQueryDto {
    pub search: Option<String>,
    pub category_id: Option<String>,
    pub collection_id: Option<String>,
    pub tag_ids: Option<Vec<String>>,
    pub is_starred: Option<bool>,
    pub processing_statuses: Option<Vec<String>>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub sort_by: Option<String>,
    pub sort_direction: Option<String>,
    pub include_deleted: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCategoryInputDto {
    pub id: Option<String>,
    pub name: String,
    pub slug: Option<String>,
    pub parent_id: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCollectionInputDto {
    pub id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone)]
struct BasicBookmarkRow {
    id: String,
    url: String,
    normalized_url: String,
    title: String,
    description: Option<String>,
    favicon: Option<String>,
    cover_url: Option<String>,
    primary_category_id: Option<String>,
    is_starred: bool,
    processing_status: String,
    processing_error: Option<String>,
    user_edited_mask: String,
    created_at: String,
    updated_at: String,
    deleted_at: Option<String>,
}

#[derive(Debug, Clone)]
struct FlatCategoryRow {
    id: String,
    name: String,
    slug: Option<String>,
    parent_id: Option<String>,
    sort_order: i64,
    is_system: bool,
    bookmark_count: i64,
    created_at: String,
    updated_at: String,
}

#[tauri::command]
pub fn desktop_create_bookmark(
    state: State<'_, DatabaseState>,
    input: CreateBookmarkInputDto,
) -> Result<BookmarkRecordDto, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    create_bookmark(&connection, input).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_get_bookmark(
    state: State<'_, DatabaseState>,
    bookmarkId: String,
) -> Result<Option<BookmarkRecordDto>, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    get_bookmark(&connection, &bookmarkId).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_list_bookmarks(
    state: State<'_, DatabaseState>,
    query: Option<BookmarkListQueryDto>,
) -> Result<Vec<BookmarkRecordDto>, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    list_bookmarks(&connection, query.unwrap_or_default()).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_update_bookmark(
    state: State<'_, DatabaseState>,
    bookmarkId: String,
    patch: UpdateBookmarkPatchDto,
) -> Result<BookmarkRecordDto, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    update_bookmark(&connection, &bookmarkId, patch).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_delete_bookmark(
    state: State<'_, DatabaseState>,
    bookmarkId: String,
) -> Result<(), String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    delete_bookmark(&connection, &bookmarkId).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_list_categories(state: State<'_, DatabaseState>) -> Result<Vec<CategoryTreeNodeDto>, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    list_categories(&connection).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_save_category(
    state: State<'_, DatabaseState>,
    input: SaveCategoryInputDto,
) -> Result<CategoryTreeNodeDto, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    save_category(&connection, input).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_delete_category(
    state: State<'_, DatabaseState>,
    categoryId: String,
) -> Result<(), String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    delete_category(&connection, &categoryId).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_list_collections(
    state: State<'_, DatabaseState>,
) -> Result<Vec<CollectionRecordDto>, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    list_collections(&connection).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_save_collection(
    state: State<'_, DatabaseState>,
    input: SaveCollectionInputDto,
) -> Result<CollectionRecordDto, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    save_collection(&connection, input).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_delete_collection(
    state: State<'_, DatabaseState>,
    collectionId: String,
) -> Result<(), String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    delete_collection(&connection, &collectionId).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_replace_bookmark_tags(
    state: State<'_, DatabaseState>,
    bookmarkId: String,
    tags: Vec<TagInputDto>,
) -> Result<Vec<TagRecordDto>, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    replace_bookmark_tags(&connection, &bookmarkId, &tags).map_err(to_command_error)
}

fn create_bookmark(connection: &Connection, input: CreateBookmarkInputDto) -> Result<BookmarkRecordDto, DbError> {
    let trimmed_url = input.url.trim().to_string();
    let normalized_url = normalize_bookmark_url(&trimmed_url);

    if normalized_url.is_empty() {
        return Err(DbError::DuplicateBookmark(String::from("<empty>")));
    }

    let existing_bookmark_id = connection
        .query_row(
            "SELECT id FROM bookmarks WHERE normalized_url = ?1 AND deleted_at IS NULL",
            [normalized_url.as_str()],
            |row| row.get::<_, String>(0),
        )
        .optional()?;

    if let Some(bookmark_id) = existing_bookmark_id {
        return Err(DbError::DuplicateBookmark(bookmark_id));
    }

    let bookmark_id = Ulid::new().to_string();
    let title = input
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(String::from)
        .unwrap_or_else(|| trimmed_url.clone());
    let description = normalize_optional_text(input.description);
    let favicon = normalize_optional_text(input.favicon);
    let cover_url = normalize_optional_text(input.cover_url);
    let primary_category_id = normalize_optional_text(input.primary_category_id)
        .or_else(|| Some(String::from("system-unsorted")));
    let processing_status = input
        .processing_status
        .filter(|value| is_processing_status(value))
        .unwrap_or_else(|| String::from("pending"));
    let processing_error = normalize_optional_text(input.processing_error);
    let user_edited_mask = input.user_edited_mask.unwrap_or_default();
    let user_edited_mask_json = serde_json::to_string(&user_edited_mask)?;

    connection.execute(
        "
        INSERT INTO bookmarks (
          id,
          url,
          normalized_url,
          title,
          description,
          favicon,
          cover_url,
          primary_category_id,
          is_starred,
          processing_status,
          processing_error,
          user_edited_mask
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        ",
        params![
            bookmark_id,
            trimmed_url,
            normalized_url,
            title,
            description,
            favicon,
            cover_url,
            primary_category_id,
            input.is_starred.unwrap_or(false),
            processing_status,
            processing_error,
            user_edited_mask_json,
        ],
    )?;

    replace_collection_memberships(connection, &bookmark_id, &input.collection_ids.unwrap_or_default())?;
    replace_bookmark_tags(connection, &bookmark_id, &input.tags.unwrap_or_default())?;
    refresh_bookmark_search(connection, &bookmark_id)?;

    get_bookmark(connection, &bookmark_id)?.ok_or(DbError::BookmarkNotFound(bookmark_id))
}

pub(crate) fn get_bookmark(connection: &Connection, bookmark_id: &str) -> Result<Option<BookmarkRecordDto>, DbError> {
    let bookmark = connection
        .query_row(
            "
            SELECT
              id,
              url,
              normalized_url,
              title,
              description,
              favicon,
              cover_url,
              primary_category_id,
              is_starred,
              processing_status,
              processing_error,
              user_edited_mask,
              created_at,
              updated_at,
              deleted_at
            FROM bookmarks
            WHERE id = ?1
            ",
            [bookmark_id],
            map_basic_bookmark_row,
        )
        .optional()?;

    bookmark.map(|row| hydrate_bookmark(connection, row)).transpose()
}

pub(crate) fn list_bookmarks(connection: &Connection, query: BookmarkListQueryDto) -> Result<Vec<BookmarkRecordDto>, DbError> {
    let mut sql = String::from(
        "
        SELECT DISTINCT
          b.id,
          b.url,
          b.normalized_url,
          b.title,
          b.description,
          b.favicon,
          b.cover_url,
          b.primary_category_id,
          b.is_starred,
          b.processing_status,
          b.processing_error,
          b.user_edited_mask,
          b.created_at,
          b.updated_at,
          b.deleted_at
        FROM bookmarks b
        ",
    );
    let mut params: Vec<Value> = Vec::new();

    if query.collection_id.as_ref().is_some() {
        sql.push_str(" INNER JOIN collection_bookmarks cb ON cb.bookmark_id = b.id");
    }

    if query.tag_ids.as_ref().filter(|values| !values.is_empty()).is_some() {
        sql.push_str(" INNER JOIN bookmark_tags bt_filter ON bt_filter.bookmark_id = b.id");
    }

    if query.search.as_ref().filter(|value| !value.trim().is_empty()).is_some() {
        sql.push_str(" INNER JOIN bookmark_search bs ON bs.bookmark_id = b.id");
    }

    sql.push_str(" WHERE 1 = 1");

    if !query.include_deleted.unwrap_or(false) {
        sql.push_str(" AND b.deleted_at IS NULL");
    }

    if let Some(category_id) = query.category_id.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        sql.push_str(" AND b.primary_category_id = ?");
        params.push(Value::Text(category_id.to_string()));
    }

    if let Some(collection_id) = query.collection_id.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        sql.push_str(" AND cb.collection_id = ?");
        params.push(Value::Text(collection_id.to_string()));
    }

    if let Some(is_starred) = query.is_starred {
        sql.push_str(" AND b.is_starred = ?");
        params.push(Value::Integer(if is_starred { 1 } else { 0 }));
    }

    if let Some(tag_ids) = query.tag_ids.as_ref().filter(|values| !values.is_empty()) {
        sql.push_str(" AND bt_filter.tag_id IN (");
        sql.push_str(&repeat_placeholders(tag_ids.len()));
        sql.push(')');

        for tag_id in tag_ids {
            params.push(Value::Text(tag_id.clone()));
        }
    }

    if let Some(processing_statuses) = query.processing_statuses.as_ref().filter(|values| !values.is_empty()) {
        sql.push_str(" AND b.processing_status IN (");
        sql.push_str(&repeat_placeholders(processing_statuses.len()));
        sql.push(')');

        for status in processing_statuses {
            params.push(Value::Text(status.clone()));
        }
    }

    if let Some(search) = query.search.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        sql.push_str(" AND bs MATCH ?");
        params.push(Value::Text(search.to_string()));
    }

    sql.push_str(" ORDER BY b.");
    sql.push_str(match query.sort_by.as_deref() {
        Some("createdAt") => "created_at",
        Some("title") => "title",
        _ => "updated_at",
    });
    sql.push(' ');
    sql.push_str(if query.sort_direction.as_deref() == Some("asc") {
        "ASC"
    } else {
        "DESC"
    });

    if let Some(limit) = query.limit.filter(|value| *value > 0) {
        sql.push_str(" LIMIT ?");
        params.push(Value::Integer(limit));
    } else if query.offset.unwrap_or_default() > 0 {
        sql.push_str(" LIMIT -1");
    }

    if let Some(offset) = query.offset.filter(|value| *value > 0) {
        sql.push_str(" OFFSET ?");
        params.push(Value::Integer(offset));
    }

    let mut statement = connection.prepare(&sql)?;
    let rows = statement.query_map(params_from_iter(params.iter()), map_basic_bookmark_row)?;
    let basic_rows = rows.collect::<Result<Vec<_>, _>>()?;

    basic_rows.into_iter().map(|row| hydrate_bookmark(connection, row)).collect()
}

fn update_bookmark(
    connection: &Connection,
    bookmark_id: &str,
    patch: UpdateBookmarkPatchDto,
) -> Result<BookmarkRecordDto, DbError> {
    let current = get_bookmark(connection, bookmark_id)?
        .ok_or_else(|| DbError::BookmarkNotFound(bookmark_id.to_string()))?;

    let url = patch.url.unwrap_or_else(|| current.url.clone());
    let normalized_url = normalize_bookmark_url(&url);

    if normalized_url != current.normalized_url {
        let duplicate = connection
            .query_row(
                "SELECT id FROM bookmarks WHERE normalized_url = ?1 AND id != ?2 AND deleted_at IS NULL",
                params![normalized_url, bookmark_id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;

        if duplicate.is_some() {
            return Err(DbError::DuplicateBookmark(normalized_url));
        }
    }

    let title = patch.title.unwrap_or(current.title);
    let description = patch.description.unwrap_or(current.description);
    let favicon = patch.favicon.unwrap_or(current.favicon);
    let cover_url = patch.cover_url.unwrap_or(current.cover_url);
    let primary_category_id = patch.primary_category_id.unwrap_or(current.primary_category_id);
    let is_starred = patch.is_starred.unwrap_or(current.is_starred);
    let processing_status = patch
        .processing_status
        .filter(|value| is_processing_status(value))
        .unwrap_or(current.processing_status);
    let processing_error = patch.processing_error.unwrap_or(current.processing_error);
    let user_edited_mask = patch.user_edited_mask.unwrap_or(current.user_edited_mask);
    let deleted_at = patch.deleted_at.unwrap_or(current.deleted_at);
    let user_edited_mask_json = serde_json::to_string(&user_edited_mask)?;

    connection.execute(
        "
        UPDATE bookmarks
        SET
          url = ?2,
          normalized_url = ?3,
          title = ?4,
          description = ?5,
          favicon = ?6,
          cover_url = ?7,
          primary_category_id = ?8,
          is_starred = ?9,
          processing_status = ?10,
          processing_error = ?11,
          user_edited_mask = ?12,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          deleted_at = ?13
        WHERE id = ?1
        ",
        params![
            bookmark_id,
            url,
            normalized_url,
            title,
            description,
            favicon,
            cover_url,
            primary_category_id,
            is_starred,
            processing_status,
            processing_error,
            user_edited_mask_json,
            deleted_at,
        ],
    )?;

    if let Some(collection_ids) = patch.collection_ids {
        replace_collection_memberships(connection, bookmark_id, &collection_ids)?;
    }

    if let Some(tags) = patch.tags {
        replace_bookmark_tags(connection, bookmark_id, &tags)?;
    }

    refresh_bookmark_search(connection, bookmark_id)?;

    get_bookmark(connection, bookmark_id)?.ok_or_else(|| DbError::BookmarkNotFound(bookmark_id.to_string()))
}

fn delete_bookmark(connection: &Connection, bookmark_id: &str) -> Result<(), DbError> {
    let affected = connection.execute(
        "
        UPDATE bookmarks
        SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1 AND deleted_at IS NULL
        ",
        [bookmark_id],
    )?;

    if affected == 0 {
        return Err(DbError::BookmarkNotFound(bookmark_id.to_string()));
    }

    refresh_bookmark_search(connection, bookmark_id)?;
    Ok(())
}

fn list_categories(connection: &Connection) -> Result<Vec<CategoryTreeNodeDto>, DbError> {
    let mut statement = connection.prepare(
        "
        SELECT
          c.id,
          c.name,
          c.slug,
          c.parent_id,
          c.sort_order,
          c.is_system,
          COUNT(b.id) AS bookmark_count,
          c.created_at,
          c.updated_at
        FROM categories c
        LEFT JOIN bookmarks b
          ON b.primary_category_id = c.id
         AND b.deleted_at IS NULL
        GROUP BY c.id, c.name, c.slug, c.parent_id, c.sort_order, c.is_system, c.created_at, c.updated_at
        ORDER BY c.sort_order ASC, c.name COLLATE NOCASE ASC
        ",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(FlatCategoryRow {
            id: row.get(0)?,
            name: row.get(1)?,
            slug: row.get(2)?,
            parent_id: row.get(3)?,
            sort_order: row.get(4)?,
            is_system: row.get::<_, i64>(5)? != 0,
            bookmark_count: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?;
    let flat_rows = rows.collect::<Result<Vec<_>, _>>()?;

    Ok(build_category_tree(&flat_rows, None))
}

fn save_category(connection: &Connection, input: SaveCategoryInputDto) -> Result<CategoryTreeNodeDto, DbError> {
    let category_id = input.id.unwrap_or_else(|| Ulid::new().to_string());
    let name = input.name.trim().to_string();
    let slug = normalize_optional_text(input.slug);
    let parent_id = normalize_optional_text(input.parent_id);
    let sort_order = input.sort_order.unwrap_or_default();

    let existing = connection.query_row(
        "SELECT COUNT(1) FROM categories WHERE id = ?1",
        [category_id.as_str()],
        |row| row.get::<_, i64>(0),
    )?;

    if existing == 0 {
        connection.execute(
            "INSERT INTO categories (id, name, slug, parent_id, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![category_id, name, slug, parent_id, sort_order],
        )?;
    } else {
        connection.execute(
            "
            UPDATE categories
            SET name = ?2,
                slug = ?3,
                parent_id = ?4,
                sort_order = ?5,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?1 AND is_system = 0
            ",
            params![category_id, name, slug, parent_id, sort_order],
        )?;
    }

    let categories = list_categories(connection)?;
    find_category_node(&categories, &category_id).ok_or(DbError::BookmarkNotFound(category_id))
}

fn delete_category(connection: &Connection, category_id: &str) -> Result<(), DbError> {
    if category_id == "system-unsorted" {
        return Err(DbError::ProtectedCategory(String::from("system-unsorted")));
    }

    let affected = connection.execute(
        "DELETE FROM categories WHERE id = ?1 AND is_system = 0",
        [category_id],
    )?;

    if affected == 0 {
        return Err(DbError::BookmarkNotFound(category_id.to_string()));
    }

    connection.execute(
        "UPDATE bookmarks SET primary_category_id = 'system-unsorted', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE primary_category_id = ?1",
        [category_id],
    )?;
    connection.execute(
        "UPDATE categories SET parent_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE parent_id = ?1",
        [category_id],
    )?;

    Ok(())
}

fn list_collections(connection: &Connection) -> Result<Vec<CollectionRecordDto>, DbError> {
    let mut statement = connection.prepare(
        "
        SELECT
          c.id,
          c.name,
          c.description,
          c.sort_order,
          COUNT(b.id) AS bookmark_count,
          c.created_at,
          c.updated_at
        FROM collections c
        LEFT JOIN collection_bookmarks cb ON cb.collection_id = c.id
        LEFT JOIN bookmarks b ON b.id = cb.bookmark_id AND b.deleted_at IS NULL
        GROUP BY c.id, c.name, c.description, c.sort_order, c.created_at, c.updated_at
        ORDER BY c.sort_order ASC, c.name COLLATE NOCASE ASC
        ",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(CollectionRecordDto {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            sort_order: row.get(3)?,
            bookmark_count: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
}

fn save_collection(connection: &Connection, input: SaveCollectionInputDto) -> Result<CollectionRecordDto, DbError> {
    let collection_id = input.id.unwrap_or_else(|| Ulid::new().to_string());
    let name = input.name.trim().to_string();
    let description = normalize_optional_text(input.description);
    let sort_order = input.sort_order.unwrap_or_default();
    let existing = connection.query_row(
        "SELECT COUNT(1) FROM collections WHERE id = ?1",
        [collection_id.as_str()],
        |row| row.get::<_, i64>(0),
    )?;

    if existing == 0 {
        connection.execute(
            "INSERT INTO collections (id, name, description, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![collection_id, name, description, sort_order],
        )?;
    } else {
        connection.execute(
            "
            UPDATE collections
            SET name = ?2,
                description = ?3,
                sort_order = ?4,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?1
            ",
            params![collection_id, name, description, sort_order],
        )?;
    }

    let mut statement = connection.prepare(
        "
        SELECT
          c.id,
          c.name,
          c.description,
          c.sort_order,
          COUNT(b.id) AS bookmark_count,
          c.created_at,
          c.updated_at
        FROM collections c
        LEFT JOIN collection_bookmarks cb ON cb.collection_id = c.id
        LEFT JOIN bookmarks b ON b.id = cb.bookmark_id AND b.deleted_at IS NULL
        WHERE c.id = ?1
        GROUP BY c.id, c.name, c.description, c.sort_order, c.created_at, c.updated_at
        ",
    )?;

    statement
        .query_row([collection_id.as_str()], |row| {
            Ok(CollectionRecordDto {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                sort_order: row.get(3)?,
                bookmark_count: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(DbError::from)
}

fn delete_collection(connection: &Connection, collection_id: &str) -> Result<(), DbError> {
    let affected = connection.execute("DELETE FROM collections WHERE id = ?1", [collection_id])?;

    if affected == 0 {
        return Err(DbError::BookmarkNotFound(collection_id.to_string()));
    }

    Ok(())
}

fn replace_bookmark_tags(
    connection: &Connection,
    bookmark_id: &str,
    tags: &[TagInputDto],
) -> Result<Vec<TagRecordDto>, DbError> {
    connection.execute("DELETE FROM bookmark_tags WHERE bookmark_id = ?1", [bookmark_id])?;

    let mut saved_tags = Vec::new();

    for tag in tags.iter().filter(|tag| !tag.label.trim().is_empty()) {
        let label = tag.label.trim().to_string();
        let existing_tag = connection
            .query_row(
                "
                SELECT id, label, color, created_at, updated_at
                FROM tags
                WHERE label = ?1 COLLATE NOCASE
                ",
                [label.as_str()],
                |row| {
                    Ok(TagRecordDto {
                        id: row.get(0)?,
                        label: row.get(1)?,
                        color: row.get(2)?,
                        created_at: row.get(3)?,
                        updated_at: row.get(4)?,
                    })
                },
            )
            .optional()?;

        let tag_record = if let Some(existing) = existing_tag {
            if tag.color != existing.color {
                connection.execute(
                    "
                    UPDATE tags
                    SET color = ?2,
                        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE id = ?1
                    ",
                    params![existing.id, tag.color],
                )?;
                load_tag(connection, &existing.id)?
            } else {
                existing
            }
        } else {
            let tag_id = tag.id.clone().unwrap_or_else(|| Ulid::new().to_string());
            connection.execute(
                "INSERT INTO tags (id, label, color) VALUES (?1, ?2, ?3)",
                params![tag_id, label, tag.color],
            )?;
            load_tag(connection, &tag_id)?
        };

        connection.execute(
            "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?1, ?2)",
            params![bookmark_id, tag_record.id.as_str()],
        )?;
        saved_tags.push(tag_record);
    }

    refresh_bookmark_search(connection, bookmark_id)?;
    Ok(saved_tags)
}

fn replace_collection_memberships(
    connection: &Connection,
    bookmark_id: &str,
    collection_ids: &[String],
) -> Result<(), DbError> {
    connection.execute("DELETE FROM collection_bookmarks WHERE bookmark_id = ?1", [bookmark_id])?;

    for (position, collection_id) in collection_ids
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .enumerate()
    {
        connection.execute(
            "
            INSERT OR IGNORE INTO collection_bookmarks (collection_id, bookmark_id, position)
            VALUES (?1, ?2, ?3)
            ",
            params![collection_id, bookmark_id, position as i64],
        )?;
    }

    Ok(())
}

fn refresh_bookmark_search(connection: &Connection, bookmark_id: &str) -> Result<(), DbError> {
    connection.execute("DELETE FROM bookmark_search WHERE bookmark_id = ?1", [bookmark_id])?;

    let searchable = connection
        .query_row(
            "SELECT title, COALESCE(description, ''), url FROM bookmarks WHERE id = ?1 AND deleted_at IS NULL",
            [bookmark_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .optional()?;

    if let Some((title, description, url)) = searchable {
        let mut statement = connection.prepare(
            "
            SELECT t.label
            FROM tags t
            INNER JOIN bookmark_tags bt ON bt.tag_id = t.id
            WHERE bt.bookmark_id = ?1
            ORDER BY t.label COLLATE NOCASE ASC
            ",
        )?;
        let tag_rows = statement.query_map([bookmark_id], |row| row.get::<_, String>(0))?;
        let tag_labels = tag_rows.collect::<Result<Vec<_>, _>>()?.join(" ");

        connection.execute(
            "
            INSERT INTO bookmark_search (bookmark_id, title, description, url, tags)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ",
            params![bookmark_id, title, description, url, tag_labels],
        )?;
    }

    Ok(())
}

fn hydrate_bookmark(connection: &Connection, row: BasicBookmarkRow) -> Result<BookmarkRecordDto, DbError> {
    let tags = load_tags_for_bookmark(connection, &row.id)?;
    let collection_ids = load_collection_ids_for_bookmark(connection, &row.id)?;
    let user_edited_mask = serde_json::from_str::<Vec<String>>(&row.user_edited_mask).unwrap_or_default();

    Ok(BookmarkRecordDto {
        id: row.id,
        url: row.url,
        normalized_url: row.normalized_url,
        title: row.title,
        description: row.description.clone(),
        description_excerpt: row.description,
        favicon: row.favicon,
        cover_url: row.cover_url,
        primary_category_id: row.primary_category_id,
        tags,
        collection_ids,
        is_starred: row.is_starred,
        processing_status: row.processing_status,
        processing_error: row.processing_error,
        user_edited_mask,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
    })
}

fn load_tags_for_bookmark(connection: &Connection, bookmark_id: &str) -> Result<Vec<TagRecordDto>, DbError> {
    let mut statement = connection.prepare(
        "
        SELECT t.id, t.label, t.color, t.created_at, t.updated_at
        FROM tags t
        INNER JOIN bookmark_tags bt ON bt.tag_id = t.id
        WHERE bt.bookmark_id = ?1
        ORDER BY t.label COLLATE NOCASE ASC
        ",
    )?;
    let rows = statement.query_map([bookmark_id], |row| {
        Ok(TagRecordDto {
            id: row.get(0)?,
            label: row.get(1)?,
            color: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
}

fn load_collection_ids_for_bookmark(connection: &Connection, bookmark_id: &str) -> Result<Vec<String>, DbError> {
    let mut statement = connection.prepare(
        "
        SELECT collection_id
        FROM collection_bookmarks
        WHERE bookmark_id = ?1
        ORDER BY position ASC, collection_id ASC
        ",
    )?;
    let rows = statement.query_map([bookmark_id], |row| row.get::<_, String>(0))?;

    rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
}

fn load_tag(connection: &Connection, tag_id: &str) -> Result<TagRecordDto, DbError> {
    connection
        .query_row(
            "SELECT id, label, color, created_at, updated_at FROM tags WHERE id = ?1",
            [tag_id],
            |row| {
                Ok(TagRecordDto {
                    id: row.get(0)?,
                    label: row.get(1)?,
                    color: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            },
        )
        .map_err(DbError::from)
}

fn map_basic_bookmark_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<BasicBookmarkRow> {
    Ok(BasicBookmarkRow {
        id: row.get(0)?,
        url: row.get(1)?,
        normalized_url: row.get(2)?,
        title: row.get(3)?,
        description: row.get(4)?,
        favicon: row.get(5)?,
        cover_url: row.get(6)?,
        primary_category_id: row.get(7)?,
        is_starred: row.get::<_, i64>(8)? != 0,
        processing_status: row.get(9)?,
        processing_error: row.get(10)?,
        user_edited_mask: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
        deleted_at: row.get(14)?,
    })
}

fn build_category_tree(rows: &[FlatCategoryRow], parent_id: Option<&str>) -> Vec<CategoryTreeNodeDto> {
    let mut nodes = rows
        .iter()
        .filter(|row| row.parent_id.as_deref() == parent_id)
        .map(|row| CategoryTreeNodeDto {
            id: row.id.clone(),
            name: row.name.clone(),
            slug: row.slug.clone(),
            parent_id: row.parent_id.clone(),
            sort_order: row.sort_order,
            is_system: row.is_system,
            bookmark_count: row.bookmark_count,
            created_at: row.created_at.clone(),
            updated_at: row.updated_at.clone(),
            children: build_category_tree(rows, Some(row.id.as_str())),
        })
        .collect::<Vec<_>>();

    nodes.sort_by(|left, right| {
        left.sort_order
            .cmp(&right.sort_order)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    nodes
}

fn find_category_node(categories: &[CategoryTreeNodeDto], category_id: &str) -> Option<CategoryTreeNodeDto> {
    for category in categories {
        if category.id == category_id {
            return Some(category.clone());
        }

        if let Some(matched) = find_category_node(&category.children, category_id) {
            return Some(matched);
        }
    }

    None
}

fn normalize_bookmark_url(input: &str) -> String {
    let trimmed = input.trim();

    if trimmed.is_empty() {
        return String::new();
    }

    if let Some(separator_index) = trimmed.find("://") {
        let scheme = trimmed[..separator_index].to_ascii_lowercase();
        let remainder = &trimmed[(separator_index + 3)..];
        let authority_length = remainder.find(['/', '?', '#']).unwrap_or(remainder.len());
        let authority = remainder[..authority_length].to_ascii_lowercase();
        let rest = &remainder[authority_length..];
        let without_hash = rest.split('#').next().unwrap_or(rest);
        let query_index = without_hash.find('?');
        let (path, query) = if let Some(index) = query_index {
            (&without_hash[..index], &without_hash[index..])
        } else {
            (without_hash, "")
        };
        let normalized_path = path.trim_end_matches('/');

        if normalized_path.is_empty() && query.is_empty() {
            return format!("{scheme}://{authority}");
        }

        return format!("{scheme}://{authority}{normalized_path}{query}");
    }

    trimmed.trim_end_matches('/').to_string()
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|candidate| {
        let trimmed = candidate.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn is_processing_status(value: &str) -> bool {
    matches!(value, "pending" | "processing" | "ready" | "failed")
}

fn repeat_placeholders(count: usize) -> String {
    std::iter::repeat("?").take(count).collect::<Vec<_>>().join(", ")
}

fn to_command_error(error: DbError) -> String {
    error.to_string()
}


