CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  privacy TEXT NOT NULL DEFAULT 'private_link',
  owner_token_hash TEXT NOT NULL,
  upload_token_hash TEXT NOT NULL,
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  chapter TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  guest_name TEXT,
  location TEXT,
  type TEXT,
  caption TEXT,
  media_kind TEXT NOT NULL DEFAULT 'note',
  file_key TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memories_event_time ON memories(event_id, captured_at);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stories_event_created ON stories(event_id, created_at DESC);
