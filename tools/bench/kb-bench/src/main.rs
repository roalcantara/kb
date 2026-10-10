//! Tier 1: benchmarks `kb-domain` on a corpus and writes one result in the schema `tools/bench/ts`
//! writes, so `xtask report` can compare the two engines case by case.
//!
//! `mise run bench:rs <corpus>` verifies the corpus first and passes its digest.

#![expect(
    clippy::print_stdout,
    clippy::print_stderr,
    reason = "a command-line tool reports to the terminal"
)]

mod env;
mod measure;
mod query;
mod stats;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;

use kb_domain::markdown::build_entry_markdown;
use kb_domain::row::row_to_entry;
use kb_domain::search::search;
use kb_domain::source::scan_knowledge_base;
use kb_domain::sync::sync_knowledge_base;
use rusqlite::{Connection, OpenFlags};
use serde_json::json;

use crate::measure::{CaseResult, measure};
use crate::query::BenchQuery;

/// `--name value` from the command line.
fn arg(name: &str) -> Result<String, String> {
    let flag = format!("--{name}");
    let args: Vec<String> = std::env::args().collect();
    args.iter()
        .position(|a| *a == flag)
        .and_then(|i| args.get(i + 1).cloned())
        .ok_or_else(|| format!("missing {flag}"))
}

fn remove_database(path: &Path) {
    for suffix in ["", "-journal", "-wal", "-shm"] {
        let _ = fs::remove_file(format!("{}{suffix}", path.display()));
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let fixtures = PathBuf::from(arg("fixtures")?);
    let corpus = arg("corpus")?;
    let digest = arg("digest")?;
    let files: usize = arg("files")?.parse()?;
    let out = PathBuf::from(arg("out")?);
    let root = fixtures.join(&corpus).canonicalize()?;
    let queries: Vec<BenchQuery> = serde_json::from_str(&fs::read_to_string(fixtures.join("queries.json"))?)?;
    let work = tempfile::tempdir()?;
    let database = work.path().join("kb.db");
    let total = 4 + 2 * queries.len();
    let mut cases: Vec<CaseResult> = Vec::new();
    let mut report = |case: CaseResult| {
        eprintln!(
            "[{}/{total}] {} (p50: {}ms)",
            cases.len() + 1,
            case.name,
            case.stats.p50 / 1_000_000
        );
        cases.push(case);
    };

    let scanned = scan_knowledge_base(&root)?;
    report(measure("scan", 3, 20, || {}, || scan_knowledge_base(&root)));
    report(measure(
        "markdown",
        3,
        20,
        || {},
        || scanned.entries.iter().map(build_entry_markdown).count(),
    ));
    let never = AtomicBool::new(false);
    report(measure(
        "sync-cold",
        2,
        10,
        || remove_database(&database),
        || sync_knowledge_base(&root, &database, &never, |_| {}),
    ));
    report(measure(
        "sync-warm",
        2,
        10,
        || {},
        || sync_knowledge_base(&root, &database, &never, |_| {}),
    ));

    // The app keeps one read-only connection for its whole life; `search-app` is that path,
    // including turning each row back into an entry for the list and the detail pane.
    let connection = Connection::open_with_flags(&database, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let sqlite: String = connection.query_row("SELECT sqlite_version()", [], |r| r.get(0))?;
    for q in &queries {
        let query = q.to_search_query();
        report(measure(
            &format!("search-app/{}", q.id),
            20,
            200,
            || {},
            || search(&connection, &query).map(|rows| rows.iter().map(row_to_entry).count()),
        ));
        report(measure(
            &format!("search-engine/{}", q.id),
            50,
            500,
            || {},
            || search(&connection, &query),
        ));
    }

    let result = json!({
        "schema": 1,
        "tier": 1,
        "implementation": "rust",
        "corpus": { "name": corpus, "digest": digest, "files": files, "entries": scanned.entries.len() },
        "env": env::capture(&sqlite),
        "cases": cases,
    });
    if let Some(parent) = out.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&out, format!("{}\n", serde_json::to_string_pretty(&result)?))?;
    println!("{} cases -> {}", cases.len(), out.display());
    Ok(())
}

fn main() -> std::process::ExitCode {
    match run() {
        Ok(()) => std::process::ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("kb-bench: {error}");
            std::process::ExitCode::FAILURE
        }
    }
}
