//! Where and with what a result was produced, as `bench/ts/env.ts` records it.

use std::process::Command;

use serde::Serialize;

/// The run's environment.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunEnv {
    /// When, in UTC.
    pub date: String,
    /// `machdep.cpu.brand_string`.
    pub cpu: String,
    /// `hw.model`.
    pub model: String,
    /// `macOS <version>`.
    pub os: String,
    /// AC Power or Battery Power.
    pub power: String,
    /// `rust-<rustc version>`.
    pub runtime: String,
    /// The bundled SQLite.
    pub sqlite: String,
    /// Not applicable to the Rust engine; kept for one schema.
    pub ts_repo_commit: String,
    /// This repository, with `-dirty` when it has uncommitted changes.
    pub repo_commit: String,
}

fn read(command: &str, args: &[&str]) -> String {
    Command::new(command)
        .args(args)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map_or_else(
            || "unknown".to_owned(),
            |o| String::from_utf8_lossy(&o.stdout).trim().to_owned(),
        )
}

/// Captures the environment.
#[must_use]
pub fn capture(sqlite: &str) -> RunEnv {
    let batt = read("pmset", &["-g", "batt"]);
    let rustc = read("rustc", &["--version"]);
    RunEnv {
        date: read("date", &["-u", "+%Y-%m-%dT%H:%M:%S.000Z"]),
        cpu: read("sysctl", &["-n", "machdep.cpu.brand_string"]),
        model: read("sysctl", &["-n", "hw.model"]),
        os: format!("macOS {}", read("sw_vers", &["-productVersion"])),
        power: batt.split('\'').nth(1).unwrap_or("unknown").to_owned(),
        runtime: format!("rust-{}", rustc.split_whitespace().nth(1).unwrap_or("unknown")),
        sqlite: sqlite.to_owned(),
        ts_repo_commit: String::new(),
        repo_commit: read("git", &["describe", "--always", "--dirty", "--abbrev=40"]),
    }
}
