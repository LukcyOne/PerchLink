CREATE TABLE IF NOT EXISTS bookmark_ai_suggestions (
  bookmark_id TEXT PRIMARY KEY REFERENCES bookmarks(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'ready', 'failed')),
  proposed_primary_category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  proposed_description TEXT,
  proposed_tags_json TEXT NOT NULL DEFAULT '[]',
  last_error TEXT,
  generated_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_bookmark_ai_suggestions_status ON bookmark_ai_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_bookmark_ai_suggestions_updated_at ON bookmark_ai_suggestions(updated_at);
