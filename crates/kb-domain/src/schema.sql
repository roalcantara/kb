CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  notes TEXT NOT NULL,
  notes_markdown TEXT NOT NULL,
  primary_content TEXT NOT NULL,
  links_json TEXT NOT NULL,
  source_file TEXT NOT NULL,
  source_rel_path TEXT NOT NULL,
  raw_yaml TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (entry_id, tag),
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
CREATE INDEX IF NOT EXISTS idx_entries_title ON entries(title);
CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags(tag);
-- Virtual table for full-text search with unicode61 tokenizer (ADR 0004)
-- Note on indexed columns: entries_fts indexes notes (clean text tokens) rather than notes_markdown.
-- Indexing raw text tokens avoids indexing markdown syntax punctuation, producing cleaner bm25 relevance scores.
CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
  title,
  description,
  notes,
  content='entries',
  content_rowid='rowid',
  tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts(rowid, title, description, notes)
  VALUES (new.rowid, new.title, new.description, new.notes);
END;

CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, description, notes)
  VALUES ('delete', old.rowid, old.title, old.description, old.notes);
END;

CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, description, notes)
  VALUES ('delete', old.rowid, old.title, old.description, old.notes);
  INSERT INTO entries_fts(rowid, title, description, notes)
  VALUES (new.rowid, new.title, new.description, new.notes);
END;
