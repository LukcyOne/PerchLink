CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  account_name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NULL,
  parent_id TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  color TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  description_excerpt TEXT NULL,
  favicon TEXT NULL,
  cover_url TEXT NULL,
  primary_category_id TEXT NULL,
  is_starred INTEGER NOT NULL DEFAULT 0,
  processing_status TEXT NOT NULL DEFAULT 'processing',
  processing_error TEXT NULL,
  user_edited_mask TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT NULL,
  FOREIGN KEY (primary_category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (bookmark_id, tag_id),
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collection_bookmarks (
  collection_id TEXT NOT NULL,
  bookmark_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (collection_id, bookmark_id),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_normalized_url ON bookmarks(normalized_url);
CREATE INDEX IF NOT EXISTS idx_bookmarks_primary_category_id ON bookmarks(primary_category_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_starred ON bookmarks(is_starred);
CREATE INDEX IF NOT EXISTS idx_bookmarks_updated_at ON bookmarks(updated_at);
CREATE INDEX IF NOT EXISTS idx_sessions_account_id ON sessions(account_id);

INSERT OR IGNORE INTO categories (
  id,
  name,
  slug,
  parent_id,
  sort_order,
  is_system,
  created_at,
  updated_at
)
VALUES (
  'system-unsorted',
  'Unsorted',
  'unsorted',
  NULL,
  0,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
