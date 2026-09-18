-- Prepared only. This migration has NOT been applied to any database.
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  quota_bytes INTEGER NOT NULL CHECK (quota_bytes > 0),
  used_bytes INTEGER NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
  expires_at TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX events_created ON events (created_at DESC, id DESC);
CREATE INDEX events_expiry ON events (expires_at);
