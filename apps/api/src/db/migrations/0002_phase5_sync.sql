ALTER TABLE categories ADD COLUMN deleted_at TEXT NULL;
ALTER TABLE categories ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE collections ADD COLUMN deleted_at TEXT NULL;
ALTER TABLE collections ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  last_cursor INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NULL,
  revoked_at TEXT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_devices_account_id ON devices(account_id);
CREATE INDEX IF NOT EXISTS idx_devices_revoked_at ON devices(revoked_at);

CREATE TABLE IF NOT EXISTS sync_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  entity_version INTEGER NOT NULL,
  writer_kind TEXT NOT NULL,
  actor_device_id TEXT NULL,
  changed_fields_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_device_id) REFERENCES devices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_events_account_seq ON sync_events(account_id, seq);
CREATE INDEX IF NOT EXISTS idx_sync_events_entity ON sync_events(account_id, entity_type, entity_id, seq);

CREATE TABLE IF NOT EXISTS sync_applied_changes (
  device_id TEXT NOT NULL,
  change_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  result_status TEXT NOT NULL,
  reason_code TEXT NULL,
  entity_version INTEGER NULL,
  event_seq INTEGER NULL,
  server_snapshot_json TEXT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (device_id, change_id),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (event_seq) REFERENCES sync_events(seq) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_applied_changes_device_created_at ON sync_applied_changes(device_id, created_at);
