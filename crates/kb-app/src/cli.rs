//! `kb [--trace | --sync]`: what the command line asks for, and the headless sync.

use std::io::Write;
use std::sync::atomic::AtomicBool;

use kb_domain::sync::{SyncError, sync_knowledge_base};

use crate::config::Config;

/// What `kb` was asked to do.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    /// Run the panel.
    Panel {
        /// Log the show and keystroke latencies to stderr (`--trace`).
        trace: bool,
    },
    /// Rebuild the index from the sources and exit (`--sync`).
    Sync,
}

/// An argument `kb` does not take.
#[derive(Debug, PartialEq, Eq, thiserror::Error)]
#[error("usage: kb [--trace | --sync]; unexpected {0}")]
pub struct UsageError(String);

/// Reads the arguments after the program name. `-psn_…`, which macOS once passed to apps opened
/// from Finder, is ignored.
///
/// # Errors
///
/// An unknown argument, or `--trace` with `--sync`.
pub fn parse(args: impl IntoIterator<Item = String>) -> Result<Mode, UsageError> {
    let (mut trace, mut sync) = (false, false);
    for arg in args {
        match arg.as_str() {
            "--trace" => trace = true,
            "--sync" => sync = true,
            psn if psn.starts_with("-psn_") => {}
            _ => return Err(UsageError(format!("`{arg}`"))),
        }
    }
    match (sync, trace) {
        (true, true) => Err(UsageError("`--trace` with `--sync`".into())),
        (true, false) => Ok(Mode::Sync),
        (false, trace) => Ok(Mode::Panel { trace }),
    }
}

/// Rebuilds the index of `config` and writes to `out` one line per source file that failed, then
/// a summary. A failed file is reported, not fatal, as in the panel's rebuild.
///
/// # Errors
///
/// The sync itself failed (an unreadable sources directory, SQLite); the previous index is
/// unchanged.
pub fn sync(config: &Config, out: &mut impl Write) -> Result<(), SyncError> {
    let summary = sync_knowledge_base(config.sources_dir(), config.database(), &AtomicBool::new(false), |_| {})?;
    for error in &summary.errors {
        let _ = writeln!(out, "kb: {}: {}", error.file_path, error.message);
    }
    let _ = writeln!(
        out,
        "kb: indexed {} entries from {} files ({} failed) in {} ms into {}",
        summary.total_indexed,
        summary.files_scanned,
        summary.files_failed,
        summary.duration_ms,
        config.database().display()
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|arg| (*arg).to_owned()).collect()
    }

    #[test]
    fn runs_the_panel_without_arguments() {
        assert_eq!(parse(args(&[])), Ok(Mode::Panel { trace: false }));
    }

    #[test]
    fn reads_trace_and_sync() {
        assert_eq!(parse(args(&["--trace"])), Ok(Mode::Panel { trace: true }));
        assert_eq!(parse(args(&["--sync"])), Ok(Mode::Sync));
    }

    #[test]
    fn ignores_the_process_serial_number_finder_may_pass() {
        assert_eq!(parse(args(&["-psn_0_12345"])), Ok(Mode::Panel { trace: false }));
    }

    #[test]
    fn rejects_unknown_arguments_and_trace_with_sync() {
        assert!(parse(args(&["--sink"])).is_err());
        assert!(parse(args(&["--sync", "--trace"])).is_err());
    }

    #[test]
    fn sync_reports_failed_files_and_a_summary() {
        let home = tempfile::tempdir().unwrap();
        let sources = home.path().join("sources");
        fs::create_dir_all(&sources).unwrap();
        fs::write(sources.join("good.yml"), "commands:\n  ls:\n    cmd: ls -la\n").unwrap();
        fs::write(sources.join("bad.yml"), "commands: [\n").unwrap();
        fs::create_dir_all(home.path().join(".config/kb")).unwrap();
        fs::write(
            home.path().join(".config/kb/config.toml"),
            format!("sources_path = \"{}\"\n", sources.display()),
        )
        .unwrap();
        let config = Config::load(home.path(), &home.path().join("data")).unwrap();

        let mut out = Vec::new();
        sync(&config, &mut out).unwrap();

        let out = String::from_utf8(out).unwrap();
        assert!(out.contains("bad.yml"), "{out}");
        assert!(out.contains("indexed 1 entries from 2 files (1 failed)"), "{out}");
        assert!(config.database().is_file());
    }
}
