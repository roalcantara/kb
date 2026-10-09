//! Repository tasks written in Rust, run through mise.
//!
//! `cargo run -p xtask -- report [--verified]` writes `docs/experiment/report.md` from the
//! results, the parity matrix and the compliance checklist. `mise run report` runs the gate and
//! golden parity first and passes `--verified` only when both pass.

#![expect(clippy::print_stderr, reason = "a command-line tool reports to the terminal")]

mod docs;
mod report;
mod results;

use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};
use std::{fs, io};

use crate::report::Inputs;
use crate::results::Results;

/// Why a task failed.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// A file or directory could not be read or written.
    #[error("{0}: {1}")]
    Io(PathBuf, io::Error),
    /// A result file is not JSON.
    #[error("{0}: {1}")]
    Json(PathBuf, serde_json::Error),
    /// The command line asks for something this tool does not do.
    #[error("usage: xtask report [--verified]")]
    Usage,
}

impl Error {
    fn io(path: &Path, error: io::Error) -> Self {
        Self::Io(path.to_owned(), error)
    }
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("xtask: {error}");
            ExitCode::FAILURE
        }
    }
}

fn run() -> Result<(), Error> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let verified = match args.iter().map(String::as_str).collect::<Vec<_>>().as_slice() {
        ["report"] => false,
        ["report", "--verified"] => true,
        _ => return Err(Error::Usage),
    };
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let experiment = root.join("docs/experiment");
    let read = |name: &str| {
        let path = experiment.join(name);
        fs::read_to_string(&path).map_err(|e| Error::io(&path, e))
    };
    let inputs = Inputs {
        results: Results::open(&experiment.join("results"))?,
        parity: read("parity.md")?,
        compliance: read("compliance.md")?,
        commit: commit(&root),
        verified,
    };
    let out = experiment.join("report.md");
    fs::write(&out, report::render(&inputs)?).map_err(|e| Error::io(&out, e))?;
    eprintln!("wrote {}", out.display());
    Ok(())
}

/// The short hash of `HEAD`, marked `-dirty` when the tree has changes; `unknown` without git.
fn commit(root: &Path) -> String {
    let git = |args: &[&str]| {
        Command::new("git")
            .args(args)
            .current_dir(root)
            .output()
            .ok()
            .filter(|output| output.status.success())
            .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_owned())
    };
    match (git(&["rev-parse", "--short", "HEAD"]), git(&["status", "--porcelain"])) {
        (Some(hash), Some(status)) if status.is_empty() => hash,
        (Some(hash), _) => format!("{hash}-dirty"),
        _ => "unknown".into(),
    }
}
