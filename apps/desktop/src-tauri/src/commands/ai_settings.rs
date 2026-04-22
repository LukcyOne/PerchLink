#![allow(non_snake_case)]

use keyring::Entry;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;
use ulid::Ulid;

use crate::db::{DatabaseState, DbError};

const AI_EXECUTION_PREFERENCES_KEY: &str = "execution_preferences";
const AI_KEYRING_SERVICE: &str = "com.perchlink.desktop.ai-provider";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderProfileRecordDto {
    pub id: String,
    pub label: String,
    pub provider_kind: String,
    pub protocol_kind: String,
    pub execution_scope: String,
    pub secret_source: String,
    pub base_url: Option<String>,
    pub model: String,
    pub timeout_ms: i64,
    pub enabled: bool,
    pub priority: i64,
    pub allow_fallback: bool,
    pub secret_status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAiProviderProfileInputDto {
    pub id: Option<String>,
    pub label: String,
    pub provider_kind: String,
    pub protocol_kind: String,
    pub execution_scope: String,
    pub base_url: Option<String>,
    pub model: String,
    pub timeout_ms: Option<i64>,
    pub enabled: Option<bool>,
    pub priority: Option<i64>,
    pub allow_fallback: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiExecutionPreferencesDto {
    pub mode: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAiExecutionPreferencesInputDto {
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredExecutionPreferences {
    mode: String,
}

#[derive(Debug, Clone)]
struct AiProviderProfileRow {
    id: String,
    label: String,
    provider_kind: String,
    protocol_kind: String,
    execution_scope: String,
    secret_source: String,
    base_url: Option<String>,
    model: String,
    timeout_ms: i64,
    enabled: bool,
    priority: i64,
    allow_fallback: bool,
    secret_status: String,
    created_at: String,
    updated_at: String,
}

#[tauri::command]
pub fn desktop_list_ai_provider_profiles(
    state: State<'_, DatabaseState>,
) -> Result<Vec<AiProviderProfileRecordDto>, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    list_ai_provider_profiles(&connection).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_save_ai_provider_profile(
    state: State<'_, DatabaseState>,
    input: SaveAiProviderProfileInputDto,
) -> Result<AiProviderProfileRecordDto, String> {
    let mut connection = state.open_connection().map_err(to_command_error)?;
    let transaction = connection
        .transaction()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    let profile = save_ai_provider_profile(&transaction, input).map_err(to_command_error)?;
    transaction
        .commit()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    Ok(profile)
}

#[tauri::command]
pub fn desktop_delete_ai_provider_profile(
    state: State<'_, DatabaseState>,
    profileId: String,
) -> Result<(), String> {
    let mut connection = state.open_connection().map_err(to_command_error)?;
    let transaction = connection
        .transaction()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    delete_ai_provider_profile(&transaction, &profileId).map_err(to_command_error)?;
    transaction
        .commit()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    Ok(())
}

#[tauri::command]
pub fn desktop_set_ai_provider_secret(
    state: State<'_, DatabaseState>,
    profileId: String,
    secret: String,
) -> Result<(), String> {
    let mut connection = state.open_connection().map_err(to_command_error)?;
    let transaction = connection
        .transaction()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    set_ai_provider_secret(&transaction, &profileId, &secret).map_err(to_command_error)?;
    transaction
        .commit()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    Ok(())
}

#[tauri::command]
pub fn desktop_clear_ai_provider_secret(
    state: State<'_, DatabaseState>,
    profileId: String,
) -> Result<(), String> {
    let mut connection = state.open_connection().map_err(to_command_error)?;
    let transaction = connection
        .transaction()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    clear_ai_provider_secret(&transaction, &profileId).map_err(to_command_error)?;
    transaction
        .commit()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    Ok(())
}

#[tauri::command]
pub fn desktop_get_ai_execution_preferences(
    state: State<'_, DatabaseState>,
) -> Result<AiExecutionPreferencesDto, String> {
    let connection = state.open_connection().map_err(to_command_error)?;
    get_ai_execution_preferences(&connection).map_err(to_command_error)
}

#[tauri::command]
pub fn desktop_save_ai_execution_preferences(
    state: State<'_, DatabaseState>,
    input: SaveAiExecutionPreferencesInputDto,
) -> Result<AiExecutionPreferencesDto, String> {
    let mut connection = state.open_connection().map_err(to_command_error)?;
    let transaction = connection
        .transaction()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    let preferences = save_ai_execution_preferences(&transaction, input).map_err(to_command_error)?;
    transaction
        .commit()
        .map_err(|error| to_command_error(DbError::from(error)))?;
    Ok(preferences)
}

fn list_ai_provider_profiles(connection: &Connection) -> Result<Vec<AiProviderProfileRecordDto>, DbError> {
    let mut statement = connection.prepare(
        "
        SELECT id,
               label,
               provider_kind,
               protocol_kind,
               execution_scope,
               secret_source,
               base_url,
               model,
               timeout_ms,
               enabled,
               priority,
               allow_fallback,
               secret_status,
               created_at,
               updated_at
          FROM ai_provider_profiles
         ORDER BY priority ASC, label ASC, id ASC
        ",
    )?;
    let rows = statement.query_map([], map_ai_provider_profile_row)?;
    let mut profiles = Vec::new();

    for row in rows {
        let profile = row?;
        profiles.push(map_ai_provider_profile_record(profile)?);
    }

    Ok(profiles)
}

fn save_ai_provider_profile(
    connection: &Connection,
    input: SaveAiProviderProfileInputDto,
) -> Result<AiProviderProfileRecordDto, DbError> {
    let profile_id = input.id.clone().unwrap_or_else(|| Ulid::new().to_string());
    let label = normalize_required_text(input.label, "Provider label is required.")?;
    let model = normalize_required_text(input.model, "Provider model is required.")?;
    let provider_kind = validate_ai_provider_kind(input.provider_kind)?;
    let protocol_kind = validate_ai_protocol_kind(input.protocol_kind)?;
    let execution_scope = validate_execution_scope(input.execution_scope)?;
    let secret_source = secret_source_for_scope(&execution_scope);
    let secret_status = resolve_secret_status(
        &profile_id,
        &execution_scope,
        if execution_scope == "server" { "external" } else { "missing" },
    );
    let base_url = normalize_optional_text(input.base_url);
    let timeout_ms = normalize_timeout_ms(input.timeout_ms);
    let enabled = input.enabled.unwrap_or(true);
    let priority = normalize_priority(input.priority);
    let allow_fallback = input.allow_fallback.unwrap_or(true);

    connection.execute(
        "
        INSERT INTO ai_provider_profiles (
          id,
          label,
          provider_kind,
          protocol_kind,
          execution_scope,
          secret_source,
          base_url,
          model,
          timeout_ms,
          enabled,
          priority,
          allow_fallback,
          secret_status
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
        ON CONFLICT(id) DO UPDATE SET
          label = excluded.label,
          provider_kind = excluded.provider_kind,
          protocol_kind = excluded.protocol_kind,
          execution_scope = excluded.execution_scope,
          secret_source = excluded.secret_source,
          base_url = excluded.base_url,
          model = excluded.model,
          timeout_ms = excluded.timeout_ms,
          enabled = excluded.enabled,
          priority = excluded.priority,
          allow_fallback = excluded.allow_fallback,
          secret_status = excluded.secret_status,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        ",
        params![
            profile_id,
            label,
            provider_kind,
            protocol_kind,
            execution_scope,
            secret_source,
            base_url,
            model,
            timeout_ms,
            bool_to_i64(enabled),
            priority,
            bool_to_i64(allow_fallback),
            secret_status,
        ],
    )?;

    get_ai_provider_profile(connection, &profile_id)?
        .ok_or_else(|| DbError::AiProviderProfileNotFound(profile_id.to_string()))
}

fn delete_ai_provider_profile(connection: &Connection, profile_id: &str) -> Result<(), DbError> {
    let profile = get_ai_provider_profile(connection, profile_id)?
        .ok_or_else(|| DbError::AiProviderProfileNotFound(profile_id.to_string()))?;

    connection.execute("DELETE FROM ai_provider_profiles WHERE id = ?1", [profile_id])?;

    if profile.secret_source == "desktop-keyring" {
        clear_secret_in_keyring(profile_id)?;
    }

    Ok(())
}

fn set_ai_provider_secret(connection: &Connection, profile_id: &str, secret: &str) -> Result<(), DbError> {
    let profile = get_ai_provider_profile(connection, profile_id)?
        .ok_or_else(|| DbError::AiProviderProfileNotFound(profile_id.to_string()))?;

    if profile.execution_scope != "local" {
        return Err(DbError::InvalidAiSettings(
            "Only local providers can store desktop secrets.".to_string(),
        ));
    }

    let trimmed_secret = secret.trim();
    if trimmed_secret.is_empty() {
        return Err(DbError::InvalidAiSettings(
            "Provider secret cannot be empty.".to_string(),
        ));
    }

    store_secret_in_keyring(profile_id, trimmed_secret)?;
    update_ai_provider_secret_status(connection, profile_id, "configured")?;
    Ok(())
}

fn clear_ai_provider_secret(connection: &Connection, profile_id: &str) -> Result<(), DbError> {
    let profile = get_ai_provider_profile(connection, profile_id)?
        .ok_or_else(|| DbError::AiProviderProfileNotFound(profile_id.to_string()))?;

    if profile.execution_scope != "local" {
        return Err(DbError::InvalidAiSettings(
            "Only local providers can clear desktop secrets.".to_string(),
        ));
    }

    clear_secret_in_keyring(profile_id)?;
    update_ai_provider_secret_status(connection, profile_id, "missing")?;
    Ok(())
}

fn get_ai_execution_preferences(connection: &Connection) -> Result<AiExecutionPreferencesDto, DbError> {
    let row = connection
        .query_row(
            "SELECT value_json, updated_at FROM ai_settings_meta WHERE key = ?1",
            [AI_EXECUTION_PREFERENCES_KEY],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()?;

    if let Some((json, updated_at)) = row {
        let payload = serde_json::from_str::<StoredExecutionPreferences>(&json)?;
        return Ok(AiExecutionPreferencesDto {
            mode: payload.mode,
            updated_at: Some(updated_at),
        });
    }

    Ok(AiExecutionPreferencesDto {
        mode: "local".to_string(),
        updated_at: None,
    })
}

fn save_ai_execution_preferences(
    connection: &Connection,
    input: SaveAiExecutionPreferencesInputDto,
) -> Result<AiExecutionPreferencesDto, DbError> {
    let mode = validate_execution_mode(input.mode)?;
    let payload = serde_json::to_string(&StoredExecutionPreferences { mode })?;

    connection.execute(
        "
        INSERT INTO ai_settings_meta (key, value_json, updated_at)
        VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = excluded.updated_at
        ",
        params![AI_EXECUTION_PREFERENCES_KEY, payload],
    )?;

    get_ai_execution_preferences(connection)
}

fn get_ai_provider_profile(
    connection: &Connection,
    profile_id: &str,
) -> Result<Option<AiProviderProfileRecordDto>, DbError> {
    connection
        .query_row(
            "
            SELECT id,
                   label,
                   provider_kind,
                   protocol_kind,
                   execution_scope,
                   secret_source,
                   base_url,
                   model,
                   timeout_ms,
                   enabled,
                   priority,
                   allow_fallback,
                   secret_status,
                   created_at,
                   updated_at
              FROM ai_provider_profiles
             WHERE id = ?1
            ",
            [profile_id],
            map_ai_provider_profile_row,
        )
        .optional()?
        .map(map_ai_provider_profile_record)
        .transpose()
}

fn map_ai_provider_profile_row(row: &rusqlite::Row<'_>) -> Result<AiProviderProfileRow, rusqlite::Error> {
    Ok(AiProviderProfileRow {
        id: row.get(0)?,
        label: row.get(1)?,
        provider_kind: row.get(2)?,
        protocol_kind: row.get(3)?,
        execution_scope: row.get(4)?,
        secret_source: row.get(5)?,
        base_url: row.get(6)?,
        model: row.get(7)?,
        timeout_ms: row.get(8)?,
        enabled: row.get::<_, i64>(9)? == 1,
        priority: row.get(10)?,
        allow_fallback: row.get::<_, i64>(11)? == 1,
        secret_status: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

fn map_ai_provider_profile_record(row: AiProviderProfileRow) -> Result<AiProviderProfileRecordDto, DbError> {
    Ok(AiProviderProfileRecordDto {
        id: row.id.clone(),
        label: row.label,
        provider_kind: row.provider_kind,
        protocol_kind: row.protocol_kind,
        execution_scope: row.execution_scope.clone(),
        secret_source: row.secret_source,
        base_url: row.base_url,
        model: row.model,
        timeout_ms: row.timeout_ms,
        enabled: row.enabled,
        priority: row.priority,
        allow_fallback: row.allow_fallback,
        secret_status: resolve_secret_status(&row.id, &row.execution_scope, &row.secret_status),
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}

fn update_ai_provider_secret_status(
    connection: &Connection,
    profile_id: &str,
    secret_status: &str,
) -> Result<(), DbError> {
    connection.execute(
        "
        UPDATE ai_provider_profiles
           SET secret_status = ?2,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?1
        ",
        params![profile_id, secret_status],
    )?;
    Ok(())
}

fn normalize_required_text(value: String, error_message: &str) -> Result<String, DbError> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        return Err(DbError::InvalidAiSettings(error_message.to_string()));
    }

    Ok(trimmed)
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|entry| {
        let trimmed = entry.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn normalize_timeout_ms(value: Option<i64>) -> i64 {
    value.unwrap_or(30_000).max(1_000)
}

fn normalize_priority(value: Option<i64>) -> i64 {
    value.unwrap_or(100).max(0)
}

fn bool_to_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn validate_ai_provider_kind(value: String) -> Result<String, DbError> {
    let normalized = value.trim().to_string();
    match normalized.as_str() {
        "openai" | "anthropic" | "gemini" | "custom" => Ok(normalized),
        _ => Err(DbError::InvalidAiSettings(format!(
            "Unsupported AI provider kind: {normalized}"
        ))),
    }
}

fn validate_ai_protocol_kind(value: String) -> Result<String, DbError> {
    let normalized = value.trim().to_string();
    match normalized.as_str() {
        "openai-compatible" | "anthropic-messages" | "gemini-rest" => Ok(normalized),
        _ => Err(DbError::InvalidAiSettings(format!(
            "Unsupported AI protocol kind: {normalized}"
        ))),
    }
}

fn validate_execution_scope(value: String) -> Result<String, DbError> {
    let normalized = value.trim().to_string();
    match normalized.as_str() {
        "local" | "server" => Ok(normalized),
        _ => Err(DbError::InvalidAiSettings(format!(
            "Unsupported AI execution scope: {normalized}"
        ))),
    }
}

fn validate_execution_mode(value: String) -> Result<String, DbError> {
    let normalized = value.trim().to_string();
    match normalized.as_str() {
        "local" | "server" | "hybrid" => Ok(normalized),
        _ => Err(DbError::InvalidAiSettings(format!(
            "Unsupported AI execution mode: {normalized}"
        ))),
    }
}

fn secret_source_for_scope(execution_scope: &str) -> &'static str {
    if execution_scope == "local" {
        "desktop-keyring"
    } else {
        "server-managed"
    }
}

fn resolve_secret_status(profile_id: &str, execution_scope: &str, fallback: &str) -> String {
    if execution_scope != "local" {
        return "external".to_string();
    }

    match load_secret_from_keyring(profile_id) {
        Ok(_) => "configured".to_string(),
        Err(keyring::Error::NoEntry) => "missing".to_string(),
        Err(_) => fallback.to_string(),
    }
}

fn keyring_entry(profile_id: &str) -> Result<Entry, DbError> {
    Entry::new(AI_KEYRING_SERVICE, profile_id)
        .map_err(|error| DbError::SecretStorage(error.to_string()))
}

fn load_secret_from_keyring(profile_id: &str) -> Result<String, keyring::Error> {
    let entry = Entry::new(AI_KEYRING_SERVICE, profile_id)?;
    entry.get_password()
}

fn store_secret_in_keyring(profile_id: &str, secret: &str) -> Result<(), DbError> {
    let entry = keyring_entry(profile_id)?;
    entry
        .set_password(secret)
        .map_err(|error| DbError::SecretStorage(error.to_string()))
}

fn clear_secret_in_keyring(profile_id: &str) -> Result<(), DbError> {
    let entry = keyring_entry(profile_id)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(DbError::SecretStorage(error.to_string())),
    }
}

fn to_command_error(error: DbError) -> String {
    error.to_string()
}
