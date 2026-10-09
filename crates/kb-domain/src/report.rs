//! What a sync says about each source file.

use std::fs;

use indexmap::IndexMap;

use crate::source::{ParsedSourceFile, SourceError};

/// Something worth telling the user about a file that otherwise indexed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FileIssue {
    /// An entry that is not a map.
    SkippedEntry {
        /// Its type.
        entry_type: String,
        /// Its key.
        key: String,
    },
    /// A file with no entries at all.
    Empty,
}

/// One source file's outcome.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileReport {
    /// Relative to the sources directory.
    pub rel_path: String,
    /// Absolute.
    pub file_path: String,
    /// Entries indexed.
    pub entries: usize,
    /// Entries per type, in order of first appearance.
    pub types: IndexMap<String, usize>,
    /// Set when the file failed.
    pub error: Option<SourceError>,
    /// The lines around the error, when it has a line.
    pub excerpt: Option<String>,
    /// Skipped entries, or that the file is empty.
    pub issues: Vec<FileIssue>,
}

/// The report for one parsed file.
#[must_use]
pub fn file_report(file_path: &str, rel_path: &str, parsed: &ParsedSourceFile) -> FileReport {
    if let Some(error) = &parsed.error {
        return FileReport {
            rel_path: rel_path.to_owned(),
            file_path: file_path.to_owned(),
            entries: 0,
            types: IndexMap::new(),
            error: Some(error.clone()),
            excerpt: error
                .line
                .map(|line| excerpt(file_path, line, 2))
                .filter(|e| !e.is_empty()),
            issues: Vec::new(),
        };
    }
    let mut types = IndexMap::new();
    for record in &parsed.records {
        *types.entry(record.entry_type.clone()).or_insert(0) += 1;
    }
    let mut issues: Vec<FileIssue> = parsed
        .skipped
        .iter()
        .map(|s| FileIssue::SkippedEntry {
            entry_type: s.entry_type.clone(),
            key: s.key.clone(),
        })
        .collect();
    if parsed.records.is_empty() && issues.is_empty() {
        issues.push(FileIssue::Empty);
    }
    FileReport {
        rel_path: rel_path.to_owned(),
        file_path: file_path.to_owned(),
        entries: parsed.records.len(),
        types,
        error: None,
        excerpt: None,
        issues,
    }
}

/// The lines around `line`, numbered, the line itself marked with `>`.
#[must_use]
pub fn excerpt(file_path: &str, line: usize, radius: usize) -> String {
    let Ok(source) = fs::read_to_string(file_path) else {
        return String::new();
    };
    let lines: Vec<&str> = source.split('\n').collect();
    if line < 1 || line > lines.len() {
        return String::new();
    }
    let from = line.saturating_sub(radius).max(1);
    let to = (line + radius).min(lines.len());
    let width = to.to_string().len();
    (from..=to)
        .map(|n| format!("{} {n:>width$} | {}", if n == line { '>' } else { ' ' }, lines[n - 1]))
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::SkippedEntry;

    #[test]
    fn numbers_and_marks_the_lines_around_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("f.yml");
        fs::write(
            &path,
            (1..=12).map(|n| format!("line {n}")).collect::<Vec<_>>().join("\n"),
        )
        .unwrap();
        let text = excerpt(&path.to_string_lossy(), 10, 2);
        assert_eq!(
            text,
            "   8 | line 8\n   9 | line 9\n> 10 | line 10\n  11 | line 11\n  12 | line 12"
        );
        assert_eq!(excerpt(&path.to_string_lossy(), 99, 2), "");
    }

    #[test]
    fn counts_types_and_flags_skipped_and_empty_files() {
        let skipped = ParsedSourceFile {
            skipped: vec![SkippedEntry {
                entry_type: "t".into(),
                key: "k".into(),
            }],
            ..ParsedSourceFile::default()
        };
        assert_eq!(
            file_report("/f", "f", &skipped).issues,
            [FileIssue::SkippedEntry {
                entry_type: "t".into(),
                key: "k".into()
            }]
        );
        assert_eq!(
            file_report("/f", "f", &ParsedSourceFile::default()).issues,
            [FileIssue::Empty]
        );
    }
}
