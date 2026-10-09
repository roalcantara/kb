//! The engine against the TypeScript engine's goldens.
//!
//! `KB_CORPUS` and `KB_GOLDENS` name a corpus and its goldens, relative to the workspace root (cargo
//! runs tests from the crate directory) or absolute; they default to the committed sample.
//! `mise run parity` points them at the private corpus.

// A test fixture that cannot be built is a failed test: its helpers panic like the tests do.
#![allow(clippy::expect_used, clippy::unwrap_used, clippy::cast_possible_truncation)]

use std::collections::BTreeSet;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;

use kb_domain::row::IndexRow;
use kb_domain::search::{FilterState, PAGE_SIZE, SearchQuery, search};
use kb_domain::sync::{SyncSummary, open_database, sync_knowledge_base};
use kb_domain::{query::fts_prefix_query, yaml};
use serde::Deserialize;
use serde_json::Value as Json;

fn workspace() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn dir(var: &str, default: &str) -> PathBuf {
    std::env::var(var).map_or_else(|_| workspace().join(default), |v| workspace().join(v))
}

struct Fixture {
    corpus: PathBuf,
    goldens: PathBuf,
    database: tempfile::TempDir,
    summary: SyncSummary,
}

fn fixture() -> Fixture {
    let corpus = dir("KB_CORPUS", "fixtures/sample").canonicalize().expect("corpus");
    let goldens = dir("KB_GOLDENS", "fixtures/sample-goldens");
    let database = tempfile::tempdir().expect("tempdir");
    let summary =
        sync_knowledge_base(&corpus, &database.path().join("kb.db"), &AtomicBool::new(false), |_| {}).expect("sync");
    Fixture {
        corpus,
        goldens,
        database,
        summary,
    }
}

fn portable(text: &str, root: &Path) -> String {
    text.replace(&root.to_string_lossy().into_owned(), "<root>")
}

#[test]
fn rows_match_the_typescript_engine() {
    let f = fixture();
    let connection = open_database(&f.database.path().join("kb.db")).unwrap();
    let mut statement = connection.prepare("SELECT * FROM entries ORDER BY id").unwrap();
    let rows: Vec<IndexRow> = statement
        .query_map([], |r| {
            Ok(IndexRow {
                id: r.get("id")?,
                title: r.get("title")?,
                description: r.get("description")?,
                entry_type: r.get("type")?,
                notes: r.get("notes")?,
                notes_markdown: r.get("notes_markdown")?,
                primary_content: r.get("primary_content")?,
                links_json: r.get("links_json")?,
                source_file: r.get("source_file")?,
                source_rel_path: r.get("source_rel_path")?,
                raw_yaml: r.get("raw_yaml")?,
            })
        })
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    let expected: Vec<IndexRow> = fs::read_to_string(f.goldens.join("rows.jsonl"))
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();

    assert_eq!(rows.len(), expected.len(), "row count");
    let mut mismatches = Vec::new();
    for (actual, golden) in rows.iter().zip(&expected) {
        let mut actual = actual.clone();
        actual.source_file = portable(&actual.source_file, &f.corpus);
        // raw_yaml is compared by value: the port writes it with saphyr's emitter.
        let same_raw = yaml::load(&actual.raw_yaml).ok() == yaml::load(&golden.raw_yaml).ok();
        actual.raw_yaml.clone_from(&golden.raw_yaml);
        if actual != *golden || !same_raw {
            mismatches.push(diff(&actual, golden, same_raw));
        }
    }
    assert!(
        mismatches.is_empty(),
        "{} of {} rows differ:\n{}",
        mismatches.len(),
        rows.len(),
        mismatches.iter().take(5).cloned().collect::<Vec<_>>().join("\n")
    );
}

fn diff(actual: &IndexRow, golden: &IndexRow, same_raw: bool) -> String {
    let a = serde_json::to_value(actual).unwrap();
    let g = serde_json::to_value(golden).unwrap();
    let mut out = format!("{}:", golden.id);
    for (key, value) in g.as_object().unwrap() {
        if a[key] != *value {
            let _ = write!(out, "\n  {key}:\n    rust: {:?}\n    ts:   {:?}", a[key], value);
        }
    }
    if !same_raw {
        out += "\n  raw_yaml: values differ";
    }
    out
}

#[test]
fn the_summary_matches_the_typescript_engine() {
    let f = fixture();
    let golden: Json = serde_json::from_str(&fs::read_to_string(f.goldens.join("summary.json")).unwrap()).unwrap();
    let s = &f.summary;
    assert_eq!(s.total_indexed, golden["totalIndexed"].as_u64().unwrap() as usize);
    assert_eq!(s.files_scanned, golden["filesScanned"].as_u64().unwrap() as usize);
    assert_eq!(s.files_failed, golden["filesFailed"].as_u64().unwrap() as usize);
    let files = golden["files"].as_array().unwrap();
    assert_eq!(s.files.len(), files.len());
    for (report, golden) in s.files.iter().zip(files) {
        assert_eq!(report.rel_path, golden["relPath"], "relPath");
        assert_eq!(
            report.entries as u64,
            golden["entries"].as_u64().unwrap(),
            "{}",
            report.rel_path
        );
        let types: Vec<(String, u64)> = report.types.iter().map(|(k, v)| (k.clone(), *v as u64)).collect();
        let golden_types: Vec<(String, u64)> = golden["types"]
            .as_object()
            .unwrap()
            .iter()
            .map(|(k, v)| (k.clone(), v.as_u64().unwrap()))
            .collect();
        assert_eq!(types, golden_types, "{} types", report.rel_path);
        assert_eq!(
            report.issues.len(),
            golden["issues"].as_array().unwrap().len(),
            "{} issues",
            report.rel_path
        );
        // A failed file fails at the same place; the parser's message is its own.
        let position = report.error.as_ref().map(|e| (e.line, e.column));
        let golden_position = golden.get("error").map(|e| {
            (
                e["line"].as_u64().map(|n| n as usize),
                e["column"].as_u64().map(|n| n as usize),
            )
        });
        assert_eq!(position, golden_position, "{} error position", report.rel_path);
        assert_eq!(
            report.excerpt.as_deref(),
            golden.get("excerpt").and_then(Json::as_str),
            "{} excerpt",
            report.rel_path
        );
    }
}

#[derive(Deserialize)]
struct GoldenQuery {
    id: String,
    text: String,
    #[serde(default)]
    types: Vec<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    offset: usize,
    results: Vec<GoldenResult>,
}

#[derive(Deserialize)]
struct GoldenResult {
    id: String,
    #[serde(rename = "sortKey")]
    sort_key: Json,
}

fn same_key(a: &Json, b: &Json) -> bool {
    match (a.as_f64(), b.as_f64()) {
        (Some(x), Some(y)) => (x - y).abs() <= 1e-9 * x.abs().max(y.abs()).max(1.0),
        _ => a == b,
    }
}

#[test]
fn queries_return_what_the_typescript_engine_returns() {
    let f = fixture();
    let connection = open_database(&f.database.path().join("kb.db")).unwrap();
    let golden: Vec<GoldenQuery> =
        serde_json::from_str(&fs::read_to_string(f.goldens.join("queries.json")).unwrap()).unwrap();
    for q in golden {
        let rows = search(
            &connection,
            &SearchQuery {
                text: q.text.clone(),
                filter: FilterState {
                    types: q.types,
                    tags: q.tags,
                },
                limit: PAGE_SIZE,
                offset: q.offset,
            },
        )
        .unwrap();
        assert_eq!(rows.len(), q.results.len(), "{}: result count", q.id);
        let fts = fts_prefix_query(&q.text);
        let keys: Vec<Json> = rows
            .iter()
            .map(|row| {
                if fts.is_empty() {
                    Json::String(row.title.clone())
                } else {
                    connection
                        .query_row(
                            "SELECT fts.rank FROM entries_fts(?) fts JOIN entries e ON e.rowid = fts.rowid WHERE e.id = ?",
                            (&fts, &row.id),
                            |r| r.get::<_, f64>(0),
                        )
                        .map(Json::from)
                        .unwrap()
                }
            })
            .collect();
        // Position by position the sort keys agree; inside a run of equal keys the ids agree as
        // a set, except in a run the page limit cuts, whose members are not defined.
        let mut start = 0;
        while start < q.results.len() {
            let mut end = start + 1;
            while end < q.results.len() && same_key(&q.results[end].sort_key, &q.results[start].sort_key) {
                end += 1;
            }
            for (i, (key, golden)) in keys.iter().zip(&q.results).enumerate().take(end).skip(start) {
                assert!(same_key(key, &golden.sort_key), "{}: sort key at {i}", q.id);
            }
            let cut = end == q.results.len() && q.results.len() == PAGE_SIZE;
            if !cut {
                let ours: BTreeSet<&str> = rows[start..end].iter().map(|r| r.id.as_str()).collect();
                let theirs: BTreeSet<&str> = q.results[start..end].iter().map(|r| r.id.as_str()).collect();
                assert_eq!(ours, theirs, "{}: ids at {start}..{end}", q.id);
            }
            start = end;
        }
    }
}
