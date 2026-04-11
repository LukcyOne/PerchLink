ALTER TABLE bookmarks ADD COLUMN version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE categories ADD COLUMN deleted_at TEXT NULL;
ALTER TABLE categories ADD COLUMN version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE collections ADD COLUMN deleted_at TEXT NULL;
ALTER TABLE collections ADD COLUMN version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  writer_kind TEXT NOT NULL,
  base_version INTEGER NULL,
  changed_fields_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL,
  auto_retry INTEGER NOT NULL DEFAULT 1 CHECK (auto_retry IN (0, 1)),
  blocked_reason TEXT NULL,
  last_error TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_outbox_entity ON sync_outbox(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_created_at ON sync_outbox(created_at);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sync_rounds (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  push_count INTEGER NOT NULL DEFAULT 0,
  pull_count INTEGER NOT NULL DEFAULT 0,
  message TEXT NULL,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  local_payload_json TEXT NULL,
  server_snapshot_json TEXT NULL,
  unread INTEGER NOT NULL DEFAULT 1 CHECK (unread IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_unread ON sync_conflicts(unread, updated_at DESC);
