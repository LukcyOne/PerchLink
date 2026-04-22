use std::{
    fs,
    path::PathBuf,
    time::Duration,
};

use rusqlite::Connection;
use tauri::{AppHandle, Manager};
use thiserror::Error;

const MIGRATIONS: [(&str, &str); 4] = [
    (
        "0001_phase2_core.sql",
        include_str!("../../migrations/0001_phase2_core.sql"),
    ),
    (
        "0002_phase3_ai_enrichment.sql",
        include_str!("../../migrations/0002_phase3_ai_enrichment.sql"),
    ),
    (
        "0003_phase5_sync.sql",
        include_str!("../../migrations/0003_phase5_sync.sql"),
    ),
    (
        "0004_phase6_ai_settings.sql",
        include_str!("../../migrations/0004_phase6_ai_settings.sql"),
    ),
];

#[derive(Debug, Error)]
pub enum DbError {
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("filesystem error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("app data path unavailable: {0}")]
    AppDataPath(String),
    #[error("bookmark already exists for key {0}")]
    DuplicateBookmark(String),
    #[error("bookmark {0} was not found")]
    BookmarkNotFound(String),
    #[error("protected category {0} cannot be deleted")]
    ProtectedCategory(String),
    #[error("AI provider {0} was not found")]
    AiProviderProfileNotFound(String),
    #[error("invalid AI settings: {0}")]
    InvalidAiSettings(String),
    #[error("secret storage error: {0}")]
    SecretStorage(String),
}

pub struct DatabaseState {
    database_path: PathBuf,
}

impl DatabaseState {
    pub fn open_connection(&self) -> Result<Connection, DbError> {
        let connection = Connection::open(&self.database_path)?;
        configure_connection(&connection)?;
        Ok(connection)
    }
}

pub fn init_database(app: &AppHandle) -> Result<DatabaseState, DbError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| DbError::AppDataPath(error.to_string()))?;

    fs::create_dir_all(&app_data_dir)?;

    let database_path = app_data_dir.join("perchlink.db");
    let connection = Connection::open(&database_path)?;

    configure_connection(&connection)?;
    apply_migrations(&connection)?;

    Ok(DatabaseState { database_path })
}

fn configure_connection(connection: &Connection) -> Result<(), DbError> {
    connection.pragma_update(None, "foreign_keys", "ON")?;
    connection.busy_timeout(Duration::from_secs(5))?;
    Ok(())
}

fn apply_migrations(connection: &Connection) -> Result<(), DbError> {
    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS schema_migrations (
          name TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
        ",
    )?;

    for (name, sql) in MIGRATIONS {
        let applied = connection.query_row(
            "SELECT COUNT(1) FROM schema_migrations WHERE name = ?1",
            [name],
            |row| row.get::<_, i64>(0),
        )?;

        if applied == 0 {
            connection.execute_batch(sql)?;
            connection.execute("INSERT INTO schema_migrations (name) VALUES (?1)", [name])?;
        }
    }

    Ok(())
}
