//! Sync: rebuilding the index from the source files.

use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use rusqlite::{Connection, ErrorCode, params};

use crate::entry::{Entry, normalize_entry};
use crate::markdown::build_entry_markdown;
use crate::report::{FileReport, file_report};
use crate::row::entry_to_row;
use crate::source::{SourceError, find_source_files, parse_source_file};

/// The index schema, statement for statement the TypeScript engine's.
pub const SCHEMA_DDL: &str = include_str!("schema.sql");

/// Why a sync stopped.
#[derive(Debug, thiserror::Error)]
pub enum SyncError {
    /// The sources directory could not be read.
    #[error("cannot read the sources directory: {0}")]
    Sources(#[from] std::io::Error),
    /// SQLite failed.
    #[error(transparent)]
    Database(#[from] rusqlite::Error),
    /// The caller cancelled; the index is unchanged.
    #[error("sync cancelled")]
    Cancelled,
}

/// What a sync reports after each file.
#[derive(Debug, Clone, Copy)]
pub struct SyncProgress<'a> {
    /// Files processed so far.
    pub files_scanned: usize,
    /// Files in all.
    pub files_total: usize,
    /// Entries indexed so far.
    pub entries_count: usize,
    /// The file just processed.
    pub file: &'a FileReport,
}

/// A finished sync.
#[derive(Debug, Clone)]
pub struct SyncSummary {
    /// Entries indexed.
    pub total_indexed: usize,
    /// Source files seen.
    pub files_scanned: usize,
    /// Source files that failed.
    pub files_failed: usize,
    /// How long it took.
    pub duration_ms: u128,
    /// One error per failed file.
    pub errors: Vec<SourceError>,
    /// Every file, in processing order.
    pub files: Vec<FileReport>,
}

/// Opens the index with foreign keys on.
///
/// # Errors
///
/// An SQLite error.
pub fn open_database(path: &Path) -> rusqlite::Result<Connection> {
    let connection = Connection::open(path)?;
    connection.pragma_update(None, "foreign_keys", true)?;
    Ok(connection)
}

/// Opens the index with its schema, replacing the file only when SQLite says it is corrupt: the
/// index is derived, so a corrupt one costs nothing to discard; any other failure is returned.
fn open_initialized(path: &Path) -> rusqlite::Result<Connection> {
    let attempt = open_database(path).and_then(|c| c.execute_batch(SCHEMA_DDL).map(|()| c));
    match attempt {
        Err(rusqlite::Error::SqliteFailure(e, _))
            if matches!(e.code, ErrorCode::DatabaseCorrupt | ErrorCode::NotADatabase) =>
        {
            for suffix in ["", "-journal", "-wal", "-shm"] {
                let _ = fs::remove_file(format!("{}{suffix}", path.display()));
            }
            let connection = open_database(path)?;
            connection.execute_batch(SCHEMA_DDL)?;
            Ok(connection)
        }
        other => other,
    }
}

/// Rebuilds the index at `database_path` from the source files under `sources_dir`, in one
/// transaction: a failure or a cancellation leaves the previous index as it was.
///
/// # Errors
///
/// The sources directory is unreadable, SQLite fails, or `cancel` was set.
pub fn sync_knowledge_base(
    sources_dir: &Path,
    database_path: &Path,
    cancel: &AtomicBool,
    mut on_progress: impl FnMut(SyncProgress<'_>),
) -> Result<SyncSummary, SyncError> {
    let started = Instant::now();
    let files = find_source_files(sources_dir)?;
    if let Some(parent) = database_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut connection = open_initialized(database_path)?;
    let transaction = connection.transaction()?;
    // entry_tags empties through its ON DELETE CASCADE.
    transaction.execute_batch("DELETE FROM entries; INSERT INTO entries_fts(entries_fts) VALUES('delete-all');")?;

    let mut summary = SyncSummary {
        total_indexed: 0,
        files_scanned: files.len(),
        files_failed: 0,
        duration_ms: 0,
        errors: Vec::new(),
        files: Vec::new(),
    };
    {
        let mut insert_entry = transaction.prepare(
            "INSERT INTO entries (id, title, description, type, notes, notes_markdown, primary_content, \
             links_json, source_file, source_rel_path, raw_yaml) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )?;
        let mut insert_tag = transaction.prepare("INSERT OR IGNORE INTO entry_tags (entry_id, tag) VALUES (?, ?)")?;
        for (index, file) in files.iter().enumerate() {
            if cancel.load(Ordering::Relaxed) {
                return Err(SyncError::Cancelled);
            }
            let file_path = file.to_string_lossy().into_owned();
            let rel_path = file
                .strip_prefix(sources_dir)
                .unwrap_or(file)
                .to_string_lossy()
                .into_owned();
            let parsed = parse_source_file(file);
            let report = file_report(&file_path, &rel_path, &parsed);
            if let Some(error) = &parsed.error {
                summary.files_failed += 1;
                summary.errors.push(error.clone());
            }
            for record in &parsed.records {
                let mut entry: Entry =
                    normalize_entry(&file_path, &rel_path, &record.entry_type, &record.key, &record.raw);
                entry.notes_markdown = build_entry_markdown(&entry);
                let row = entry_to_row(&entry);
                insert_entry.execute(params![
                    row.id,
                    row.title,
                    row.description,
                    row.entry_type,
                    row.notes,
                    row.notes_markdown,
                    row.primary_content,
                    row.links_json,
                    row.source_file,
                    row.source_rel_path,
                    row.raw_yaml
                ])?;
                for tag in &entry.tags {
                    insert_tag.execute(params![row.id, tag])?;
                }
                summary.total_indexed += 1;
            }
            on_progress(SyncProgress {
                files_scanned: index + 1,
                files_total: files.len(),
                entries_count: summary.total_indexed,
                file: &report,
            });
            summary.files.push(report);
        }
    }
    transaction.commit()?;
    summary.duration_ms = started.elapsed().as_millis();
    Ok(summary)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sources(files: &[(&str, &str)]) -> tempfile::TempDir {
        let root = tempfile::tempdir().unwrap();
        for (path, content) in files {
            fs::write(root.path().join(path), content).unwrap();
        }
        root
    }

    fn count(path: &Path, table: &str) -> i64 {
        open_database(path)
            .unwrap()
            .query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn indexes_entries_tags_and_full_text() {
        let root = sources(&[
            ("a.yml", "commands:\n  docker ps: {tags: [docker, Ops]}\n  ls: {}\n"),
            ("b.yml", "x: [\n"),
        ]);
        let db = tempfile::tempdir().unwrap();
        let path = db.path().join("nested/kb.db");
        let mut seen = Vec::new();
        let summary = sync_knowledge_base(root.path(), &path, &AtomicBool::new(false), |p| {
            seen.push(p.files_scanned);
        })
        .unwrap();
        assert_eq!(
            (summary.total_indexed, summary.files_scanned, summary.files_failed),
            (2, 2, 1)
        );
        assert_eq!(seen, [1, 2]);
        assert_eq!(count(&path, "entries"), 2);
        assert_eq!(count(&path, "entry_tags"), 2);
        assert_eq!(count(&path, "entries_fts('\"dock\"*')"), 1);
    }

    #[test]
    fn a_cancelled_sync_leaves_the_previous_index() {
        let root = sources(&[("a.yml", "notes:\n  one: {}\n")]);
        let db = tempfile::tempdir().unwrap();
        let path = db.path().join("kb.db");
        sync_knowledge_base(root.path(), &path, &AtomicBool::new(false), |_| {}).unwrap();
        fs::write(root.path().join("a.yml"), "notes:\n  one: {}\n  two: {}\n").unwrap();
        let result = sync_knowledge_base(root.path(), &path, &AtomicBool::new(true), |_| {});
        assert!(matches!(result, Err(SyncError::Cancelled)));
        assert_eq!(count(&path, "entries"), 1);
    }

    #[test]
    fn replaces_a_corrupt_index() {
        let root = sources(&[("a.yml", "notes:\n  one: {}\n")]);
        let db = tempfile::tempdir().unwrap();
        let path = db.path().join("kb.db");
        fs::write(
            &path,
            "not a database, just text that is long enough to be read as a header....",
        )
        .unwrap();
        let summary = sync_knowledge_base(root.path(), &path, &AtomicBool::new(false), |_| {}).unwrap();
        assert_eq!(summary.total_indexed, 1);
    }
}
