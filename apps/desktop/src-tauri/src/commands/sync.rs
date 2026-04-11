#![allow(non_snake_case)]

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    db::{DatabaseState, DbError},
};

use super::bookmarks::{refresh_bookmark_search, replace_bookmark_tags, replace_collection_memberships, TagInputDto};

const SYNC_CONNECTION_META_KEY: &str = "sync_connection";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SyncDeviceRecordDto {
    pub id: String,
    pub device_name: String,
    pub last_cursor: i64,
    pub created_at: String,
    pub updated_at: String,
    pub last_seen_at: Option<String>,
    pub revoked_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SyncConnectionRecordDto {
    pub remote_address: Option<String>,
    pub account_id: Option<String>,
    pub account_name: Option<String>,
    pub session_token: Option<String>,
    pub device_token: Option<String>,
    pub current_device: Option<SyncDeviceRecordDto>,
    pub local_only: bool,
    pub registration_required: bool,
    pub syncing: bool,
    pub last_push_at: Option<String>,
    pub last_pull_at: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatusSnapshotDto {
    pub connection_state: String,
    pub remote_address: Option<String>,
    pub local_only: bool,
    pub pending_push_count: i64,
    pub unread_conflict_count: i64,
    pub last_push_at: Option<String>,
    pub last_pull_at: Option<String>,
    pub last_error: Option<String>,
    pub current_device: Option<SyncDeviceRecordDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncOutboxChangeDto {
    pub change_id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub operation: String,
    pub writer_kind: String,
    pub base_version: Option<i64>,
    pub changed_fields: Vec<String>,
    pub snapshot: serde_json::Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPushResultDto {
    pub change_id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub status: String,
    pub reason_code: Option<String>,
    pub applied_entity_version: Option<i64>,
    pub server_seq: Option<i64>,
    pub server_snapshot: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPullEventDto {
    pub seq: i64,
    pub entity_type: String,
    pub entity_id: String,
    pub operation: String,
    pub entity_version: i64,
    pub writer_kind: String,
    pub actor_device_id: Option<String>,
    pub changed_fields: Vec<String>,
    pub snapshot: serde_json::Value,
    pub occurred_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncBookmarkTagDto {
    id: String,
    label: String,
    color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncBookmarkSnapshotDto {
    id: String,
    url: String,
    normalized_url: String,
    title: String,
    description: Option<String>,
    description_excerpt: Option<String>,
    favicon: Option<String>,
    cover_url: Option<String>,
    primary_category_id: Option<String>,
    is_starred: bool,
    processing_status: String,
    processing_error: Option<String>,
    user_edited_mask: Vec<String>,
    tags: Vec<SyncBookmarkTagDto>,
    collection_ids: Vec<String>,
    created_at: String,
    updated_at: String,
    deleted_at: Option<String>,
    version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncCategorySnapshotDto {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncCollectionSnapshotDto {
    id: String,
    name: String,
    description: Option<String>,
    sort_order: i64,
    created_at: String,
    updated_at: String,
    deleted_at: Option<String>,
    version: i64,
}

fn to_command_error(error: DbError) -> String {
    error.to_string()
}

fn get_sync_connection(connection: &Connection) -> Result<Option<SyncConnectionRecordDto>, DbError> {
    connection
        .query_row(
            "SELECT value_json FROM sync_meta WHERE key = ?1",
            [SYNC_CONNECTION_META_KEY],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .map(|json| serde_json::from_str::<SyncConnectionRecordDto>(&json))
        .transpose()
        .map_err(DbError::from)
}

fn save_sync_connection_record(
    connection: &Connection,
    record: &SyncConnectionRecordDto,
) -> Result<SyncConnectionRecordDto, DbError> {
    let json = serde_json::to_string(record)?;
    connection.execute(
        "
        INSERT INTO sync_meta (key, value_json, updated_at)
        VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = excluded.updated_at
        ",
        params![SYNC_CONNECTION_META_KEY, json],
    )?;
    Ok(record.clone())
}

fn clear_sync_connection_record(connection: &Connection) -> Result<(), DbError> {
    connection.execute("DELETE FROM sync_meta WHERE key = ?1", [SYNC_CONNECTION_META_KEY])?;
    Ok(())
}

fn count_pending_pushes(connection: &Connection) -> Result<i64, DbError> {
    connection
        .query_row(
            "SELECT COUNT(1) FROM sync_outbox WHERE auto_retry = 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(DbError::from)
}

fn count_unread_conflicts(connection: &Connection) -> Result<i64, DbError> {
    connection
        .query_row(
            "SELECT COUNT(1) FROM sync_conflicts WHERE unread = 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(DbError::from)
}

fn derive_connection_state(connection_record: &Option<SyncConnectionRecordDto>, unread_conflicts: i64) -> String {
    if let Some(connection) = connection_record {
        if connection.local_only {
            return "local-only".to_string();
        }

        if connection.registration_required || connection.current_device.is_none() || connection.device_token.is_none() {
            return "registration-required".to_string();
        }

        if connection.syncing {
            return "syncing".to_string();
        }

        if unread_conflicts > 0 || connection.last_error.is_some() {
            return "needs-attention".to_string();
        }

        return "up-to-date".to_string();
    }

    "local-only".to_string()
}

fn upsert_conflict_record(
    connection: &Connection,
    result: &SyncPushResultDto,
    local_payload: Option<serde_json::Value>,
) -> Result<(), DbError> {
    let conflict_id = format!("{}:{}", result.entity_type, result.entity_id);
    connection.execute(
        "
        INSERT INTO sync_conflicts (
          id,
          entity_type,
          entity_id,
          reason_code,
          local_payload_json,
          server_snapshot_json,
          unread,
          created_at,
          updated_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, 1,
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        )
        ON CONFLICT(id) DO UPDATE SET
          reason_code = excluded.reason_code,
          local_payload_json = excluded.local_payload_json,
          server_snapshot_json = excluded.server_snapshot_json,
          unread = 1,
          updated_at = excluded.updated_at
        ",
        params![
            conflict_id,
            result.entity_type,
            result.entity_id,
            result.reason_code.clone().unwrap_or_else(|| "validation_failed".to_string()),
            local_payload.map(|payload| payload.to_string()),
            result.server_snapshot.as_ref().map(|snapshot| snapshot.to_string()),
        ],
    )?;
    Ok(())
}

fn apply_bookmark_snapshot(connection: &Connection, snapshot_value: serde_json::Value) -> Result<(), DbError> {
    let snapshot = serde_json::from_value::<SyncBookmarkSnapshotDto>(snapshot_value)?;
    let user_edited_mask_json = serde_json::to_string(&snapshot.user_edited_mask)?;

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
          user_edited_mask,
          created_at,
          updated_at,
          deleted_at,
          version
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
        ON CONFLICT(id) DO UPDATE SET
          url = excluded.url,
          normalized_url = excluded.normalized_url,
          title = excluded.title,
          description = excluded.description,
          favicon = excluded.favicon,
          cover_url = excluded.cover_url,
          primary_category_id = excluded.primary_category_id,
          is_starred = excluded.is_starred,
          processing_status = excluded.processing_status,
          processing_error = excluded.processing_error,
          user_edited_mask = excluded.user_edited_mask,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          version = excluded.version
        ",
        params![
            snapshot.id,
            snapshot.url,
            snapshot.normalized_url,
            snapshot.title,
            snapshot.description,
            snapshot.favicon,
            snapshot.cover_url,
            snapshot.primary_category_id,
            snapshot.is_starred,
            snapshot.processing_status,
            snapshot.processing_error,
            user_edited_mask_json,
            snapshot.created_at,
            snapshot.updated_at,
            snapshot.deleted_at,
            snapshot.version,
        ],
    )?;

    connection.execute("DELETE FROM bookmark_tags WHERE bookmark_id = ?1", [&snapshot.id])?;
    let tags = snapshot
        .tags
        .iter()
        .map(|tag| TagInputDto {
            id: Some(tag.id.clone()),
            label: tag.label.clone(),
            color: tag.color.clone(),
        })
        .collect::<Vec<_>>();
    replace_bookmark_tags(connection, &snapshot.id, &tags)?;
    replace_collection_memberships(connection, &snapshot.id, &snapshot.collection_ids)?;
    refresh_bookmark_search(connection, &snapshot.id)?;
    Ok(())
}

fn apply_category_snapshot(connection: &Connection, snapshot_value: serde_json::Value) -> Result<(), DbError> {
    let snapshot = serde_json::from_value::<SyncCategorySnapshotDto>(snapshot_value)?;
    connection.execute(
        "
        INSERT INTO categories (
          id,
          name,
          slug,
          parent_id,
          sort_order,
          is_system,
          created_at,
          updated_at,
          deleted_at,
          version
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          slug = excluded.slug,
          parent_id = excluded.parent_id,
          sort_order = excluded.sort_order,
          is_system = excluded.is_system,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          version = excluded.version
        ",
        params![
            snapshot.id,
            snapshot.name,
            snapshot.slug,
            snapshot.parent_id,
            snapshot.sort_order,
            snapshot.is_system,
            snapshot.created_at,
            snapshot.updated_at,
            snapshot.deleted_at,
            snapshot.version,
        ],
    )?;
    Ok(())
}

fn apply_collection_snapshot(connection: &Connection, snapshot_value: serde_json::Value) -> Result<(), DbError> {
    let snapshot = serde_json::from_value::<SyncCollectionSnapshotDto>(snapshot_value)?;
    connection.execute(
        "
        INSERT INTO collections (
          id,
          name,
          description,
          sort_order,
          created_at,
          updated_at,
          deleted_at,
          version
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          sort_order = excluded.sort_order,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          version = excluded.version
        ",
        params![
            snapshot.id,
            snapshot.name,
            snapshot.description,
            snapshot.sort_order,
            snapshot.created_at,
            snapshot.updated_at,
            snapshot.deleted_at,
            snapshot.version,
        ],
    )?;

    if snapshot.deleted_at.is_some() {
        connection.execute("DELETE FROM collection_bookmarks WHERE collection_id = ?1", [&snapshot.id])?;
    }

    Ok(())
}

#[tauri::command]
pub fn desktop_get_sync_connection(state: State<'_, DatabaseState>) -> Result<Option<SyncConnectionRecordDto>, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    get_sync_connection(&connection).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_get_sync_status(state: State<'_, DatabaseState>) -> Result<SyncStatusSnapshotDto, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    let connection_record = get_sync_connection(&connection).map_err(to_command_error)?;
    let unread_conflicts = count_unread_conflicts(&connection).map_err(to_command_error)?;
    Ok(SyncStatusSnapshotDto {
        connection_state: derive_connection_state(&connection_record, unread_conflicts),
        remote_address: connection_record.as_ref().and_then(|record| record.remote_address.clone()),
        local_only: connection_record.as_ref().map(|record| record.local_only).unwrap_or(true),
        pending_push_count: count_pending_pushes(&connection).map_err(to_command_error)?,
        unread_conflict_count: unread_conflicts,
        last_push_at: connection_record.as_ref().and_then(|record| record.last_push_at.clone()),
        last_pull_at: connection_record.as_ref().and_then(|record| record.last_pull_at.clone()),
        last_error: connection_record.as_ref().and_then(|record| record.last_error.clone()),
        current_device: connection_record.and_then(|record| record.current_device),
    })
}

#[tauri::command]
pub fn desktop_save_sync_connection(
    state: State<'_, DatabaseState>,
    record: SyncConnectionRecordDto,
) -> Result<SyncConnectionRecordDto, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    save_sync_connection_record(&connection, &record).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_clear_sync_connection(state: State<'_, DatabaseState>) -> Result<(), String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    clear_sync_connection_record(&connection).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_list_sync_outbox(state: State<'_, DatabaseState>) -> Result<Vec<SyncOutboxChangeDto>, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    let mut statement = connection
        .prepare(
            "
            SELECT id, entity_type, entity_id, operation, writer_kind, base_version, changed_fields_json, payload_json, created_at
            FROM sync_outbox
            WHERE auto_retry = 1
            ORDER BY created_at ASC
            ",
        )
        .map_err(|error| to_command_error(DbError::from(error)))?;
    let rows = statement
        .query_map([], |row| {
            let changed_fields_json = row.get::<_, String>(6)?;
            let payload_json = row.get::<_, String>(7)?;
            Ok(SyncOutboxChangeDto {
                change_id: row.get(0)?,
                entity_type: row.get(1)?,
                entity_id: row.get(2)?,
                operation: row.get(3)?,
                writer_kind: row.get(4)?,
                base_version: row.get(5)?,
                changed_fields: serde_json::from_str(&changed_fields_json).unwrap_or_default(),
                snapshot: serde_json::from_str(&payload_json).unwrap_or_else(|_| serde_json::json!({})),
                created_at: row.get(8)?,
            })
        })
        .map_err(|error| to_command_error(DbError::from(error)))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| to_command_error(DbError::from(error)))
}

#[tauri::command]
pub fn desktop_ack_sync_push_results(
    state: State<'_, DatabaseState>,
    results: Vec<SyncPushResultDto>,
) -> Result<(), String> {
    let mut connection = state.open_connection().map_err(to_command_error)?;
    let transaction = connection
        .transaction()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    for result in results {
        let local_payload = transaction
            .query_row(
                "SELECT payload_json FROM sync_outbox WHERE id = ?1",
                [&result.change_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| to_command_error(DbError::from(error)))?
            .and_then(|json| serde_json::from_str::<serde_json::Value>(&json).ok());

        match result.status.as_str() {
            "accepted" | "accepted_merged" | "noop" => {
                transaction
                    .execute("DELETE FROM sync_outbox WHERE id = ?1", [&result.change_id])
                    .map_err(|error| to_command_error(DbError::from(error)))?;
            }
            "conflict" | "rejected" => {
                transaction
                    .execute(
                        "
                        UPDATE sync_outbox
                        SET auto_retry = 0,
                            blocked_reason = ?2,
                            last_error = ?3,
                            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                        WHERE id = ?1
                        ",
                        params![
                            result.change_id,
                            result.reason_code.clone(),
                            result.reason_code.clone().unwrap_or_else(|| "sync_rejected".to_string()),
                        ],
                    )
                    .map_err(|error| to_command_error(DbError::from(error)))?;
                upsert_conflict_record(&transaction, &result, local_payload).map_err(to_command_error)?;
            }
            _ => {}
        }
    }

    if let Some(mut connection_record) = get_sync_connection(&transaction).map_err(to_command_error)? {
        connection_record.last_push_at = Some(chrono_like_now());
        connection_record.last_error = None;
        connection_record.syncing = false;
        save_sync_connection_record(&transaction, &connection_record).map_err(to_command_error)?;
    }

    transaction
        .commit()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    Ok(())
}

#[tauri::command]
pub fn desktop_apply_remote_events(
    state: State<'_, DatabaseState>,
    events: Vec<SyncPullEventDto>,
    serverCursor: i64,
) -> Result<(), String> {
    let mut connection = state.open_connection().map_err(to_command_error)?;
    let transaction = connection
        .transaction()
        .map_err(|error| to_command_error(DbError::from(error)))?;

    for event in events {
        match event.entity_type.as_str() {
            "bookmark" => apply_bookmark_snapshot(&transaction, event.snapshot).map_err(to_command_error)?,
            "category" => apply_category_snapshot(&transaction, event.snapshot).map_err(to_command_error)?,
            "collection" => apply_collection_snapshot(&transaction, event.snapshot).map_err(to_command_error)?,
            _ => {}
        }
    }

    if let Some(mut connection_record) = get_sync_connection(&transaction).map_err(to_command_error)? {
        if let Some(current_device) = connection_record.current_device.as_mut() {
            current_device.last_cursor = serverCursor;
            current_device.updated_at = chrono_like_now();
            current_device.last_seen_at = Some(chrono_like_now());
        }
        connection_record.last_pull_at = Some(chrono_like_now());
        connection_record.last_error = None;
        connection_record.syncing = false;
        save_sync_connection_record(&transaction, &connection_record).map_err(to_command_error)?;
    }

    transaction
        .commit()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    Ok(())
}

fn chrono_like_now() -> String {
    let connection = Connection::open_in_memory().expect("in-memory sqlite should open");
    connection
        .query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')", [], |row| row.get::<_, String>(0))
        .expect("sqlite should format timestamp")
}
