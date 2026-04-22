CREATE TABLE IF NOT EXISTS ai_provider_profiles (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  protocol_kind TEXT NOT NULL,
  execution_scope TEXT NOT NULL,
  secret_source TEXT NOT NULL,
  base_url TEXT NULL,
  model TEXT NOT NULL,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  priority INTEGER NOT NULL DEFAULT 100,
  allow_fallback INTEGER NOT NULL DEFAULT 1 CHECK (allow_fallback IN (0, 1)),
  secret_status TEXT NOT NULL DEFAULT 'missing',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_profiles_priority
  ON ai_provider_profiles(priority ASC, label ASC, id ASC);

CREATE TABLE IF NOT EXISTS ai_settings_meta (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
