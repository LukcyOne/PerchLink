use std::collections::BTreeSet;

use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value as JsonValue};
use ulid::Ulid;

use crate::db::DbError;

const ENTITY_BOOKMARK: &str = "bookmark";
const ENTITY_CATEGORY: &str = "category";
const ENTITY_COLLECTION: &str = "collection";
const OPERATION_UPSERT: &str = "upsert";
const OPERATION_DELETE: &str = "delete";

#[derive(Debug, Clone, Copy)]
pub(crate) enum SyncWriterKind {
    User,
    System,
    Ai,
}

impl SyncWriterKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::User => "user",
            Self::System => "system",
            Self::Ai => "ai",
        }
    }
}

#[derive(Debug)]
struct SyncOutboxRow {
    id: String,
    operation: String,
    base_version: Option<i64>,
    changed_fields_json: String,
}

#[derive(Debug)]
struct BookmarkSyncRow {
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
    version: i64,
}

#[derive(Debug)]
struct CategorySyncRow {
    id: String,
    name: String,
    slug: Option<String>,
    parent_id: Option<String>,
    sort_order: i64,
    is_system: bool,
    created_at: String,
    updated_at: String,
    deleted_at: Option<String>,
    version: i64,
}

#[derive(Debug)]
struct CollectionSyncRow {
    id: String,
    name: String,
    description: Option<String>,
    sort_order: i64,
    created_at: String,
    updated_at: String,
    deleted_at: Option<String>,
    version: i64,
}

fn normalized_base_version(version: i64) -> Option<i64> {
    if version <= 0 {
        None
    } else {
        Some(version)
    }
}

fn merge_changed_fields(existing_json: &str, next_fields: &[&str]) -> Result<String, DbError> {
    let existing = serde_json::from_str::<Vec<String>>(existing_json).unwrap_or_default();
    let mut merged = BTreeSet::new();

    for field in existing {
        merged.insert(field);
    }

    for field in next_fields {
        merged.insert((*field).to_string());
    }

    Ok(serde_json::to_string(&merged.into_iter().collect::<Vec<_>>())?)
}

fn load_sync_outbox_row(
    connection: &Connection,
    entity_type: &str,
    entity_id: &str,
) -> Result<Option<SyncOutboxRow>, DbError> {
    connection
        .query_row(
            "
            SELECT id, operation, base_version, changed_fields_json
            FROM sync_outbox
            WHERE entity_type = ?1 AND entity_id = ?2
            ",
            params![entity_type, entity_id],
            |row| {
                Ok(SyncOutboxRow {
                    id: row.get(0)?,
                    operation: row.get(1)?,
                    base_version: row.get(2)?,
                    changed_fields_json: row.get(3)?,
                })
            },
        )
        .optional()
        .map_err(DbError::from)
}

fn upsert_sync_outbox(
    connection: &Connection,
    entity_type: &str,
    entity_id: &str,
    operation: &str,
    writer_kind: SyncWriterKind,
    base_version: Option<i64>,
    changed_fields: &[&str],
    payload: JsonValue,
) -> Result<(), DbError> {
    let payload_json = serde_json::to_string(&payload)?;
    let changed_fields_json = serde_json::to_string(
        &changed_fields
            .iter()
            .map(|field| (*field).to_string())
            .collect::<Vec<_>>(),
    )?;

    if let Some(existing) = load_sync_outbox_row(connection, entity_type, entity_id)? {
        if existing.operation == OPERATION_UPSERT && existing.base_version.is_none() && operation == OPERATION_DELETE {
            connection.execute("DELETE FROM sync_outbox WHERE id = ?1", [existing.id])?;
            return Ok(());
        }

        let merged_fields_json = merge_changed_fields(&existing.changed_fields_json, changed_fields)?;
        connection.execute(
            "
            UPDATE sync_outbox
            SET operation = ?2,
                writer_kind = ?3,
                base_version = ?4,
                changed_fields_json = ?5,
                payload_json = ?6,
                auto_retry = 1,
                blocked_reason = NULL,
                last_error = NULL,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?1
            ",
            params![
                existing.id,
                operation,
                writer_kind.as_str(),
                existing.base_version.or(base_version),
                merged_fields_json,
                payload_json,
            ],
        )?;
    } else {
        connection.execute(
            "
            INSERT INTO sync_outbox (
              id,
              entity_type,
              entity_id,
              operation,
              writer_kind,
              base_version,
              changed_fields_json,
              payload_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ",
            params![
                Ulid::new().to_string(),
                entity_type,
                entity_id,
                operation,
                writer_kind.as_str(),
                base_version,
                changed_fields_json,
                payload_json,
            ],
        )?;
    }

    Ok(())
}

fn load_bookmark_sync_row(connection: &Connection, bookmark_id: &str) -> Result<BookmarkSyncRow, DbError> {
    connection
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
              deleted_at,
              version
            FROM bookmarks
            WHERE id = ?1
            ",
            [bookmark_id],
            |row| {
                Ok(BookmarkSyncRow {
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
                    version: row.get(15)?,
                })
            },
        )
        .map_err(DbError::from)
}

fn build_bookmark_sync_payload(connection: &Connection, bookmark_id: &str) -> Result<JsonValue, DbError> {
    let row = load_bookmark_sync_row(connection, bookmark_id)?;
    let tags = connection
        .prepare(
            "
            SELECT t.id, t.label, t.color
            FROM tags t
            INNER JOIN bookmark_tags bt ON bt.tag_id = t.id
            WHERE bt.bookmark_id = ?1
            ORDER BY t.label COLLATE NOCASE ASC
            ",
        )?
        .query_map([bookmark_id], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "label": row.get::<_, String>(1)?,
                "color": row.get::<_, Option<String>>(2)?,
            }))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let collection_ids = connection
        .prepare(
            "
            SELECT collection_id
            FROM collection_bookmarks
            WHERE bookmark_id = ?1
            ORDER BY position ASC, collection_id ASC
            ",
        )?
        .query_map([bookmark_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    let user_edited_mask = serde_json::from_str::<Vec<String>>(&row.user_edited_mask).unwrap_or_default();

    Ok(json!({
        "entityType": ENTITY_BOOKMARK,
        "id": row.id,
        "url": row.url,
        "normalizedUrl": row.normalized_url,
        "title": row.title,
        "description": row.description,
        "descriptionExcerpt": row.description,
        "favicon": row.favicon,
        "coverUrl": row.cover_url,
        "primaryCategoryId": row.primary_category_id,
        "isStarred": row.is_starred,
        "processingStatus": row.processing_status,
        "processingError": row.processing_error,
        "userEditedMask": user_edited_mask,
        "tags": tags,
        "collectionIds": collection_ids,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "deletedAt": row.deleted_at,
        "version": row.version,
    }))
}

fn load_category_sync_row(connection: &Connection, category_id: &str) -> Result<CategorySyncRow, DbError> {
    connection
        .query_row(
            "
            SELECT id, name, slug, parent_id, sort_order, is_system, created_at, updated_at, deleted_at, version
            FROM categories
            WHERE id = ?1
            ",
            [category_id],
            |row| {
                Ok(CategorySyncRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    slug: row.get(2)?,
                    parent_id: row.get(3)?,
                    sort_order: row.get(4)?,
                    is_system: row.get::<_, i64>(5)? != 0,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                    deleted_at: row.get(8)?,
                    version: row.get(9)?,
                })
            },
        )
        .map_err(DbError::from)
}

fn build_category_sync_payload(connection: &Connection, category_id: &str) -> Result<JsonValue, DbError> {
    let row = load_category_sync_row(connection, category_id)?;
    Ok(json!({
        "entityType": ENTITY_CATEGORY,
        "id": row.id,
        "name": row.name,
        "slug": row.slug,
        "parentId": row.parent_id,
        "sortOrder": row.sort_order,
        "isSystem": row.is_system,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "deletedAt": row.deleted_at,
        "version": row.version,
    }))
}

fn load_collection_sync_row(connection: &Connection, collection_id: &str) -> Result<CollectionSyncRow, DbError> {
    connection
        .query_row(
            "
            SELECT id, name, description, sort_order, created_at, updated_at, deleted_at, version
            FROM collections
            WHERE id = ?1
            ",
            [collection_id],
            |row| {
                Ok(CollectionSyncRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    sort_order: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    deleted_at: row.get(6)?,
                    version: row.get(7)?,
                })
            },
        )
        .map_err(DbError::from)
}

fn build_collection_sync_payload(connection: &Connection, collection_id: &str) -> Result<JsonValue, DbError> {
    let row = load_collection_sync_row(connection, collection_id)?;
    Ok(json!({
        "entityType": ENTITY_COLLECTION,
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "sortOrder": row.sort_order,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "deletedAt": row.deleted_at,
        "version": row.version,
    }))
}

pub(crate) fn enqueue_bookmark_sync_change(
    connection: &Connection,
    bookmark_id: &str,
    operation: &str,
    writer_kind: SyncWriterKind,
    changed_fields: &[&str],
) -> Result<(), DbError> {
    let base_version = normalized_base_version(load_bookmark_sync_row(connection, bookmark_id)?.version);
    let payload = build_bookmark_sync_payload(connection, bookmark_id)?;
    upsert_sync_outbox(
        connection,
        ENTITY_BOOKMARK,
        bookmark_id,
        operation,
        writer_kind,
        base_version,
        changed_fields,
        payload,
    )
}

pub(crate) fn enqueue_category_sync_change(
    connection: &Connection,
    category_id: &str,
    operation: &str,
    writer_kind: SyncWriterKind,
    changed_fields: &[&str],
) -> Result<(), DbError> {
    let base_version = normalized_base_version(load_category_sync_row(connection, category_id)?.version);
    let payload = build_category_sync_payload(connection, category_id)?;
    upsert_sync_outbox(
        connection,
        ENTITY_CATEGORY,
        category_id,
        operation,
        writer_kind,
        base_version,
        changed_fields,
        payload,
    )
}

pub(crate) fn enqueue_collection_sync_change(
    connection: &Connection,
    collection_id: &str,
    operation: &str,
    writer_kind: SyncWriterKind,
    changed_fields: &[&str],
) -> Result<(), DbError> {
    let base_version = normalized_base_version(load_collection_sync_row(connection, collection_id)?.version);
    let payload = build_collection_sync_payload(connection, collection_id)?;
    upsert_sync_outbox(
        connection,
        ENTITY_COLLECTION,
        collection_id,
        operation,
        writer_kind,
        base_version,
        changed_fields,
        payload,
    )
}

pub(crate) fn sync_operation_upsert() -> &'static str {
    OPERATION_UPSERT
}

pub(crate) fn sync_operation_delete() -> &'static str {
    OPERATION_DELETE
}
