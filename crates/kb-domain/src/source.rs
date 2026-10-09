//! Source files: finding them and reading their entries.

use std::fs;
use std::path::{Path, PathBuf};

use saphyr::YamlOwned;
use walkdir::WalkDir;

use crate::yaml::{self, scalar_text};

/// One entry as its source wrote it, before normalization.
#[derive(Debug, Clone, PartialEq)]
pub struct RawEntryRecord {
    /// The entry type: the top-level key.
    pub entry_type: String,
    /// The entry key.
    pub key: String,
    /// The entry's map.
    pub raw: YamlOwned,
}

/// An entry whose value is not a map, so it cannot be indexed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkippedEntry {
    /// The entry type.
    pub entry_type: String,
    /// The entry key.
    pub key: String,
}

/// Why a source file could not be read, and where.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceError {
    /// The file.
    pub file_path: String,
    /// What went wrong.
    pub message: String,
    /// 1-based line, when known.
    pub line: Option<usize>,
    /// 1-based column, when known.
    pub column: Option<usize>,
}

/// What one source file yields.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ParsedSourceFile {
    /// Entries that are maps.
    pub records: Vec<RawEntryRecord>,
    /// Entries that are not.
    pub skipped: Vec<SkippedEntry>,
    /// Set when the file failed; `records` and `skipped` are then empty.
    pub error: Option<SourceError>,
}

/// Every `.yml` and `.yaml` file under `sources_dir`, recursively, following symlinks, skipping
/// names that start with a dot, sorted by path.
///
/// # Errors
///
/// The root cannot be read: a sync must fail before it opens a transaction, or zero files would
/// commit as an empty index.
pub fn find_source_files(sources_dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    fs::read_dir(sources_dir)?;
    let mut files: Vec<PathBuf> = WalkDir::new(sources_dir)
        .follow_links(true)
        .into_iter()
        .filter_entry(|e| e.depth() == 0 || !e.file_name().to_string_lossy().starts_with('.'))
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
        .map(walkdir::DirEntry::into_path)
        .filter(|p| p.extension().is_some_and(|x| x == "yml" || x == "yaml"))
        .collect();
    files.sort();
    Ok(files)
}

/// Reads one source file's entries; a syntax error, or a type block that is a list, fails the
/// whole file.
#[must_use]
pub fn parse_source_file(file_path: &Path) -> ParsedSourceFile {
    let path = file_path.to_string_lossy().into_owned();
    let failed = |message: String, line, column| ParsedSourceFile {
        error: Some(SourceError {
            file_path: path.clone(),
            message,
            line,
            column,
        }),
        ..ParsedSourceFile::default()
    };
    let source = match fs::read_to_string(file_path) {
        Ok(source) => source,
        Err(error) => return failed(error.to_string(), None, None),
    };
    let document = match yaml::load(&source) {
        Ok(Some(YamlOwned::Mapping(types))) => types,
        Ok(_) => return ParsedSourceFile::default(),
        Err(error) => return failed(error.message, Some(error.line), Some(error.column)),
    };

    let mut parsed = ParsedSourceFile::default();
    let mut rejections = Vec::new();
    for (type_key, entries) in &document {
        let entry_type = scalar_text(type_key).unwrap_or_default();
        match entries {
            // A list would key its entries by position, so their ids would change on reorder.
            YamlOwned::Sequence(_) => {
                rejections.push(format!(
                    "type block \"{entry_type}\" is a list; it must be a map of keys to entries"
                ));
            }
            YamlOwned::Mapping(entries) => {
                for (key, raw) in entries {
                    let key = scalar_text(key).unwrap_or_default();
                    if matches!(raw, YamlOwned::Mapping(_)) {
                        parsed.records.push(RawEntryRecord {
                            entry_type: entry_type.clone(),
                            key,
                            raw: raw.clone(),
                        });
                    } else {
                        parsed.skipped.push(SkippedEntry {
                            entry_type: entry_type.clone(),
                            key,
                        });
                    }
                }
            }
            _ => {}
        }
    }
    if rejections.is_empty() {
        parsed
    } else {
        failed(rejections.join("; "), None, None)
    }
}

/// Every entry under `sources_dir`, normalized, and the files that failed.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ScanResult {
    /// The entries, in file and source order; `notes_markdown` is not compiled.
    pub entries: Vec<crate::entry::Entry>,
    /// One error per failed file.
    pub errors: Vec<SourceError>,
}

/// Reads and normalizes every entry under `sources_dir`, without touching the index.
///
/// # Errors
///
/// The sources directory cannot be read.
pub fn scan_knowledge_base(sources_dir: &Path) -> std::io::Result<ScanResult> {
    let mut result = ScanResult::default();
    for file in find_source_files(sources_dir)? {
        let file_path = file.to_string_lossy().into_owned();
        let rel_path = file
            .strip_prefix(sources_dir)
            .unwrap_or(&file)
            .to_string_lossy()
            .into_owned();
        let parsed = parse_source_file(&file);
        if let Some(error) = parsed.error {
            result.errors.push(error);
            continue;
        }
        for record in &parsed.records {
            result.entries.push(crate::entry::normalize_entry(
                &file_path,
                &rel_path,
                &record.entry_type,
                &record.key,
                &record.raw,
            ));
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tree(files: &[(&str, &str)]) -> tempfile::TempDir {
        let root = tempfile::tempdir().unwrap();
        for (path, content) in files {
            let path = root.path().join(path);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, content).unwrap();
        }
        root
    }

    #[test]
    fn finds_yaml_files_sorted_skipping_dot_names() {
        let root = tree(&[
            ("b.yml", ""),
            ("a/c.yaml", ""),
            ("a/d.txt", ""),
            (".hidden/e.yml", ""),
            (".f.yml", ""),
        ]);
        let found: Vec<String> = find_source_files(root.path())
            .unwrap()
            .iter()
            .map(|p| p.strip_prefix(root.path()).unwrap().to_string_lossy().into_owned())
            .collect();
        assert_eq!(found, ["a/c.yaml", "b.yml"]);
    }

    #[test]
    fn fails_when_the_root_cannot_be_read() {
        assert!(find_source_files(Path::new("/no/such/sources")).is_err());
    }

    #[test]
    fn separates_map_entries_from_skipped_ones() {
        let root = tree(&[("f.yml", "commands:\n  ls: {desc: list}\n  pwd: just a string\nempty:\n")]);
        let parsed = parse_source_file(&root.path().join("f.yml"));
        assert_eq!(parsed.records.len(), 1);
        assert_eq!(
            parsed.skipped,
            [SkippedEntry {
                entry_type: "commands".into(),
                key: "pwd".into()
            }]
        );
        assert_eq!(parsed.error, None);
    }

    #[test]
    fn rejects_a_type_block_that_is_a_list() {
        let root = tree(&[("f.yml", "commands:\n  - a\n")]);
        let error = parse_source_file(&root.path().join("f.yml")).error.unwrap();
        assert_eq!(
            error.message,
            "type block \"commands\" is a list; it must be a map of keys to entries"
        );
        assert_eq!((error.line, error.column), (None, None));
    }

    #[test]
    fn scans_entries_and_collects_failed_files() {
        let root = tree(&[("ok.yml", "notes:\n  a: {title: A}\n"), ("bad.yml", "a: [\n")]);
        let scan = scan_knowledge_base(root.path()).unwrap();
        assert_eq!(
            scan.entries.iter().map(|e| e.id.as_str()).collect::<Vec<_>>(),
            ["ok.yml#notes#a"]
        );
        assert_eq!(scan.errors.len(), 1);
    }
}
