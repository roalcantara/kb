# kb native port — Plan 5: MVP compliance, measurement and report

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Tasks 9–12 need the owner at the machine (Accessibility permission, Raycast, a screen recording); stop and hand
> over at Task 9.

**Goal:** Finish the experiment: every figure comes from a mise task run in one ordered session, then the generated
report, a hand-written findings note and a README summary close it.

**Architecture:** Small tooling additions around what exists: a headless `kb --sync` and a `bench:home` task give kb an
isolated, synced home; `bench:cpu`, `bench:size` and `bench:session` wire the existing probes into one ordered run
behind a preflight check; `manual-keystroke.sh` turns hand-counted frames into a result; `maint.sh` and `xtask` gain
dependency depth, coverage, duplication and lint rows and a link to `findings.md`.

**Tech Stack:** Rust 2024 (`kb-app`, `xtask`), bash + jq probes, mise tasks, cargo-llvm-cov, jscpd, npm (read only).

**Spec:** [docs/superpowers/specs/2026-10-10-kb-native-05-measurement-and-report-design.md][spec] (decisions D1–D7).

[spec]: ../specs/2026-10-10-kb-native-05-measurement-and-report-design.md

---

## Done before this plan (`06190c7`, verified 2026-10-10)

Half 1, MVP compliance and packaging, and the measurement infrastructure. The full gate passes (83 tests, 5 doctests).

- Theme follows the system appearance; start-up failures are in-panel notifications; sentence-case labels; ⌘Q /
  "Quit kb"; `kb-app`'s public surface narrowed; every `#[allow]` is an `#[expect(…, reason)]`.
- `kb.app` packaging (`cargo-packager`, `LSUIElement`, `dev.roalcantara.kb`), icon pipeline, ADR 0006,
  `docs/experiment/compliance.md`.
- CGEvent probe, tier 2/3 probe scripts, `bench:memory`, `bench:e2e`, `bench:maint`, `xtask report`, `mise run report`.
- Tier 1 results (`tier1-*-20261009T08*`) stay valid: `06190c7` changed only comments and doctests in `kb-domain`.
  Tier 1 is not re-run.

## File map

| Path                                                                             | Responsibility                                            | Task   |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- | ------ |
| `crates/kb-app/src/cli.rs` (new), `src/lib.rs`, `src/main.rs`                    | `kb [--trace \| --sync]`: argument parsing, headless sync | 1      |
| `crates/kb-app/tests/sync_cli.rs` (new)                                          | the built binary syncs without a window                   | 1      |
| `mise.toml`, `bench/probes/kb-home.sh` (new), four kb probes                     | `bench:home`; every kb probe runs under the synced home   | 2      |
| `.gitignore`, `bench/probes/latency.sh`, `crates/xtask/src/report.rs`            | Raycast's hotkey from `KB_RAYCAST_HOTKEY`                 | 3      |
| `bench/probes/manual-keystroke.sh` (new), `crates/xtask/src/report.rs`           | manual keystroke run as a result, shown in the report     | 4      |
| `bench/probes/maint.sh`, `crates/xtask/src/report.rs`                            | depth, coverage, duplication, clippy rows                 | 5      |
| `crates/xtask/src/report.rs`, `crates/xtask/src/main.rs`                         | link to `findings.md` under the Verdict                   | 6      |
| `mise.toml`, `bench/probes/preflight.sh` (new)                                   | `bench:cpu`, `bench:size`, `bench:session`, preflight     | 7      |
| `docs/experiment/methodology.md`, the experiment spec, `CONTEXT.md`, `README.md` | the session, home, hotkey, manual run, amendment          | 8      |
| `docs/experiment/results/*.json`                                                 | the measurement session (owner)                           | 9, 10  |
| `docs/experiment/report.md`, `findings.md`, `README.md`                          | report, findings, README summary                          | 11, 12 |

---

### Task 1: `kb --sync`, a headless index rebuild

**Files:**

- Create: `crates/kb-app/src/cli.rs`
- Modify: `crates/kb-app/src/lib.rs` (module list)
- Modify: `crates/kb-app/src/main.rs` (whole file)
- Test: `crates/kb-app/src/cli.rs` (`#[cfg(test)]`), `crates/kb-app/tests/sync_cli.rs`

- [ ] **Step 1: Write the failing unit tests**

Create `crates/kb-app/src/cli.rs` with only the tests and empty stubs, so it compiles and fails:

```rust
//! `kb [--trace | --sync]`: what the command line asks for, and the headless sync.

use std::io::Write;

use kb_domain::sync::SyncError;

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

/// Reads the arguments after the program name.
///
/// # Errors
///
/// An unknown argument, or `--trace` with `--sync`.
pub fn parse(_args: impl IntoIterator<Item = String>) -> Result<Mode, UsageError> {
    unimplemented!()
}

/// Rebuilds the index of `config`.
///
/// # Errors
///
/// The sync itself failed.
pub fn sync(_config: &Config, _out: &mut impl Write) -> Result<(), SyncError> {
    unimplemented!()
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
```

In `crates/kb-app/src/lib.rs`, add the module after `config` (it is public: `main` uses it):

```rust
pub mod cli;
pub mod config;
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo nextest run -p kb-app cli::`
Expected: FAIL, 5 tests panicking with "not implemented".

- [ ] **Step 3: Implement `parse` and `sync`**

Replace the two stubs and the imports in `crates/kb-app/src/cli.rs`:

```rust
use std::io::Write;
use std::sync::atomic::AtomicBool;

use kb_domain::sync::{SyncError, sync_knowledge_base};

use crate::config::Config;
```

```rust
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
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `cargo nextest run -p kb-app cli::`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing integration test**

Create `crates/kb-app/tests/sync_cli.rs`:

```rust
//! `kb --sync`: the built binary rebuilds the index under `HOME` without opening a window.

#![expect(clippy::unwrap_used, reason = "a fixture that cannot be built is a failed test")]

use std::fs;
use std::path::Path;
use std::process::{Command, Output};

fn sync_under(home: &Path, sources: &Path) -> Output {
    fs::create_dir_all(home.join(".config/kb")).unwrap();
    fs::write(
        home.join(".config/kb/config.toml"),
        format!("sources_path = \"{}\"\n", sources.display()),
    )
    .unwrap();
    Command::new(env!("CARGO_BIN_EXE_kb"))
        .arg("--sync")
        .env("HOME", home)
        .output()
        .unwrap()
}

#[test]
fn syncs_the_configured_sources_into_the_data_directory() {
    let home = tempfile::tempdir().unwrap();
    let sample = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures/sample")
        .canonicalize()
        .unwrap();

    let output = sync_under(home.path(), &sample);

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(output.status.success(), "{stderr}");
    assert!(stderr.contains("kb: indexed "), "{stderr}");
    assert!(home.path().join("Library/Application Support/kb-native/kb.db").is_file());
}

#[test]
fn fails_when_the_sources_directory_is_missing() {
    let home = tempfile::tempdir().unwrap();

    let output = sync_under(home.path(), &home.path().join("nowhere"));

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(!output.status.success());
    assert!(stderr.contains("cannot read the sources directory"), "{stderr}");
}
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cargo nextest run -p kb-app --test sync_cli`
Expected: FAIL — `main` ignores `--sync` and starts the panel, so the process does not exit with the expected
output. If it hangs, stop it after the nextest slow-test timeout; that is the failure.

- [ ] **Step 7: Dispatch on the mode in `main`**

Replace `crates/kb-app/src/main.rs`:

```rust
//! `kb [--trace | --sync]`: resolves the configuration, then runs the panel or rebuilds the index.

use std::fmt::Display;
use std::io;
use std::process::ExitCode;

use kb_app::cli::{self, Mode};
use kb_app::config::Config;

fn main() -> ExitCode {
    let mode = match cli::parse(std::env::args().skip(1)) {
        Ok(mode) => mode,
        Err(error) => return fail(error),
    };
    let (Some(home), Some(data)) = (dirs::home_dir(), dirs::data_dir()) else {
        return fail("cannot find the home and data directories");
    };
    match mode {
        // No panel shows a notice in a headless sync, so unreadable preferences stop it.
        Mode::Sync => match Config::load(&home, &data) {
            Ok(config) => match cli::sync(&config, &mut io::stderr().lock()) {
                Ok(()) => ExitCode::SUCCESS,
                Err(error) => fail(error),
            },
            Err(error) => fail(error),
        },
        Mode::Panel { trace } => {
            // Unreadable preferences do not stop the app: it starts on the defaults and says why in
            // the panel, where someone who launched it from Finder will see it.
            let (config, notices) = match Config::load(&home, &data) {
                Ok(config) => (config, Vec::new()),
                Err(error) => (
                    Config::defaults(&home, &data),
                    vec![format!("Using the default sources: {error}")],
                ),
            };
            kb_app::run(config, notices, trace);
            ExitCode::SUCCESS
        }
    }
}

/// Reports `error` and fails: without a window, stderr is the only channel.
fn fail(error: impl Display) -> ExitCode {
    #[expect(clippy::print_stderr, reason = "no window exists: stderr is the only channel")]
    {
        eprintln!("kb: {error}");
    }
    ExitCode::FAILURE
}
```

- [ ] **Step 8: Run the integration test and the fast gate**

Run: `cargo nextest run -p kb-app --test sync_cli && mise run gate --fast`
Expected: 2 passed; then every test passes and clippy reports nothing.

- [ ] **Step 9: Commit**

```bash
git add crates/kb-app/src/cli.rs crates/kb-app/src/lib.rs crates/kb-app/src/main.rs crates/kb-app/tests/sync_cli.rs
git commit -m "feat(app): Add kb --sync to rebuild the index without a window"
```

---

### Task 2: `bench:home`, and the kb probes run under it

**Files:**

- Modify: `mise.toml` (new task after `[tasks.install]`)
- Create: `bench/probes/kb-home.sh`
- Modify: `bench/probes/memory.sh`, `bench/probes/latency.sh`, `bench/probes/action.sh`, `bench/probes/cpu-rs.sh`

- [ ] **Step 1: Add the task**

In `mise.toml`, after `[tasks.install]`:

```toml
[tasks."bench:home"]
description = "Build tmp/bench-home: a home whose kb config points at fixtures/private, with its index synced"
run = '''
  #!/usr/bin/env bash
  set -euo pipefail
  mise run fixtures
  cargo build --release --locked -p kb-app
  home="$PWD/tmp/bench-home"
  mkdir -p "$home/.config/kb"
  printf 'sources_path = "%s"\n' "$PWD/fixtures/private" >"$home/.config/kb/config.toml"
  HOME="$home" target/release/kb --sync
'''
```

- [ ] **Step 2: Run it**

Run: `mise run bench:home`
Expected: "private corpus verified; private-10x rebuilt", then
`kb: indexed <n> entries from 68 files (0 failed) in <ms> ms into …/tmp/bench-home/Library/Application Support/kb-native/kb.db`.
If `fixtures/private` is missing, run `mise run fixtures --refresh` first (owner: it reads `$KB_SOURCES`).

- [ ] **Step 3: Add the shared helper**

Create `bench/probes/kb-home.sh`:

```bash
# Sourced by the kb probes. Sets kb_home, the home kb runs under: $KB_HOME, else tmp/bench-home
# (mise run bench:home), so kb reads fixtures/private like the runs it is compared with. Stops
# when that home holds no index.
# shellcheck shell=bash
kb_home=${KB_HOME:-$PWD/tmp/bench-home}
[ -f "$kb_home/Library/Application Support/kb-native/kb.db" ] || {
  echo "no kb index under $kb_home; run mise run bench:home"
  exit 1
}
```

- [ ] **Step 4: Use it in the four kb probes**

`bench/probes/memory.sh`, in the `kb)` branch, replace

```bash
open ${KB_HOME:+--env "HOME=$KB_HOME"} "$app_path"
```

with

```bash
# shellcheck source=/dev/null
. "$here/kb-home.sh"
open --env "HOME=$kb_home" "$app_path"
```

`bench/probes/latency.sh`, in the `kb)` branch, replace

```bash
HOME=${KB_HOME:-$HOME} "$binary" --trace 2>>"$trace" &
```

with

```bash
# shellcheck source=/dev/null
. "$(dirname "$0")/kb-home.sh"
HOME=$kb_home "$binary" --trace 2>>"$trace" &
```

`bench/probes/action.sh`, in the `kb)` branch, replace

```bash
HOME=${KB_HOME:-$HOME} "$binary" 2>/dev/null &
```

with

```bash
# shellcheck source=/dev/null
. "$(dirname "$0")/kb-home.sh"
HOME=$kb_home "$binary" 2>/dev/null &
```

`bench/probes/cpu-rs.sh`, after the `[ -d "$app" ] && [ -x "$probe" ] || {…}` check, add

```bash
# shellcheck source=/dev/null
. "$(dirname "$0")/kb-home.sh"
```

and replace

```bash
open ${KB_HOME:+--env "HOME=$KB_HOME"} "$app"
```

with

```bash
open --env "HOME=$kb_home" "$app"
```

In the usage comment of each of the four, change `[KB_HOME=<home>]` to
`[KB_HOME=<home>, default tmp/bench-home]`.

- [ ] **Step 5: Check the scripts**

Run: `hk check --all && KB_HOME=/nonexistent bench/probes/cpu-rs.sh /tmp 1 1; echo "exit $?"`
Expected: hk passes (shellcheck, shfmt); the probe prints either "need target/packager/kb.app …" (not packaged yet) or
"no kb index under /nonexistent; run mise run bench:home", and `exit 1`.

- [ ] **Step 6: Commit**

```bash
git add mise.toml bench/probes/kb-home.sh bench/probes/memory.sh bench/probes/latency.sh bench/probes/action.sh bench/probes/cpu-rs.sh
git commit -m "feat(bench): Run the kb probes under a synced bench home"
```

---

### Task 3: Raycast's hotkey is `KB_RAYCAST_HOTKEY`

**Files:**

- Modify: `.gitignore`
- Modify: `bench/probes/latency.sh` (header comment, `raycast)` branch)
- Modify: `crates/xtask/src/report.rs` (`perceived`, the hotkey note)

- [ ] **Step 1: Ignore the local mise file**

Append to `.gitignore`:

```gitignore
# Machine-local settings, such as KB_RAYCAST_HOTKEY (docs/experiment/methodology.md).
/mise.local.toml
```

- [ ] **Step 2: Require the hotkey**

In `bench/probes/latency.sh`, replace the two header lines

```bash
# Usage: [KB_HOME=<home>, default tmp/bench-home] [HOTKEY="49 cmd"] latency.sh kb|raycast <results-dir> [runs]
#   HOTKEY: Raycast's hotkey as "<keycode> <mods>"; default ⌘Space, its root search.
```

with

```bash
# Usage: [KB_HOME=<home>, default tmp/bench-home] [KB_RAYCAST_HOTKEY="<keycode> <mods>"] latency.sh kb|raycast <results-dir> [runs]
#   KB_RAYCAST_HOTKEY: the hotkey assigned to kb Search in Raycast (set it in mise.local.toml);
#   required for raycast, so the run times the kb command and not Raycast's root search.
```

and in the `raycast)` branch replace

```bash
read -r code mods <<<"${HOTKEY:-49 cmd}"
```

with

```bash
[ -n "${KB_RAYCAST_HOTKEY:-}" ] || {
  echo "set KB_RAYCAST_HOTKEY to kb Search's hotkey in Raycast (docs/experiment/methodology.md, Tier 3)"
  exit 1
}
read -r code mods <<<"$KB_RAYCAST_HOTKEY"
```

- [ ] **Step 3: Update the report's note**

In `crates/xtask/src/report.rs`, `perceived`, replace

```rust
"its root search, not the kb command: assign a hotkey to kb Search and pass it as \
 `HOTKEY` to compare the two commands"
```

with

```rust
"its root search, not the kb command: assign a hotkey to kb Search and set it as \
 `KB_RAYCAST_HOTKEY` to compare the two commands"
```

- [ ] **Step 4: Check**

Run: `hk check --all && env -u KB_RAYCAST_HOTKEY bench/probes/latency.sh raycast /tmp 1; echo "exit $?"`
Expected: hk passes; the probe prints "need tmp/bin/probe; run mise run probes" or the `KB_RAYCAST_HOTKEY` message,
and `exit 1`.

- [ ] **Step 5: Commit**

```bash
git add .gitignore bench/probes/latency.sh crates/xtask/src/report.rs
git commit -m "feat(bench): Require kb Search's Raycast hotkey for the latency run"
```

---

### Task 4: The manual keystroke run is a result

**Files:**

- Create: `bench/probes/manual-keystroke.sh`
- Modify: `crates/xtask/src/report.rs` (`perceived`; tests)

- [ ] **Step 1: Write the failing xtask tests**

In `crates/xtask/src/report.rs`, `mod tests`, add `use std::fs;` under `use super::*;` and append:

```rust
    /// A results directory holding `files` (name, JSON).
    fn results_with(files: &[(&str, &str)]) -> (tempfile::TempDir, Results) {
        let dir = tempfile::tempdir().unwrap();
        for (name, json) in files {
            fs::write(dir.path().join(name), json).unwrap();
        }
        let results = Results::open(dir.path()).unwrap();
        (dir, results)
    }

    #[test]
    fn shows_the_manual_raycast_keystroke_run() {
        let (_dir, results) = results_with(&[(
            "tier3-raycast-keystroke-manual-20261010T120000Z.json",
            r#"{"stats": {"p25": 25.0, "p50": 33.3, "p75": 41.7}}"#,
        )]);
        let (out, _) = perceived(&results).unwrap();
        let row = out.lines().find(|l| l.starts_with("| Keystroke → updated list")).unwrap();
        assert!(row.contains("| 33.3 (25.0–41.7) |"), "{row}");
    }

    #[test]
    fn says_when_the_manual_keystroke_run_is_missing() {
        let (_dir, results) = results_with(&[]);
        let (out, _) = perceived(&results).unwrap();
        let row = out.lines().find(|l| l.starts_with("| Keystroke → updated list")).unwrap();
        assert!(row.contains("| manual: not recorded |"), "{row}");
    }
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cargo nextest run -p xtask keystroke`
Expected: FAIL — both rows still read "manual (methodology)".

- [ ] **Step 3: Read the manual run in `perceived`**

In `perceived`, after the `kb_action, raycast_action` binding add:

```rust
let raycast_keystroke = results.latest("tier3-raycast-keystroke-manual")?;
```

and replace the keystroke row

```rust
vec![
    "Keystroke → updated list, 150 ms debounce included (`kb --trace`)".to_owned(),
    "manual (methodology)".into(),
    quartiles(kb.as_ref(), Some("keystroke-trace-presented")),
],
```

with

```rust
vec![
    "Keystroke → updated list (Raycast: counted at 120 fps; kb: `kb --trace`, 150 ms debounce included)"
        .to_owned(),
    raycast_keystroke
        .as_ref()
        .map_or_else(|| "manual: not recorded".into(), |run| quartiles(Some(run), None)),
    quartiles(kb.as_ref(), Some("keystroke-trace-presented")),
],
```

- [ ] **Step 4: Run them to verify they pass**

Run: `cargo nextest run -p xtask`
Expected: PASS, every xtask test.

- [ ] **Step 5: Add the recording script**

Create `bench/probes/manual-keystroke.sh` (then `chmod +x`):

```bash
#!/usr/bin/env bash
# Tier 3, Raycast keystroke → updated list, timed by hand (methodology, "Tier 3"): record the
# screen at <fps> while typing the last letter of a query, and for each run count the frames from
# the key's echo in the search field to the list's change. Turns the counts into a result in the
# shared schema: samples in ms, nearest-rank stats.
# Usage: manual-keystroke.sh <results-dir> <fps> <frames>...
set -euo pipefail

[ $# -ge 3 ] || {
  echo "usage: manual-keystroke.sh <results-dir> <fps> <frames>..."
  exit 2
}
results=$1
fps=$2
shift 2
stamp=$(date -u +%Y%m%dT%H%M%SZ)

printf '%s\n' "$@" | jq -s --argjson fps "$fps" --arg date "$(date -u +%FT%TZ)" \
  '. as $frames | map(. * 1000 / $fps) as $samples | ($samples | sort) as $s | ($s | length) as $n |
   {schema: 1, tier: 3, metric: "keystroke-manual", unit: "ms", implementation: "ts", app: "raycast",
    method: "manual-\($fps)fps", date: $date, frames: $frames, samples: $samples,
    stats: {n: $n, min: $s[0], p25: $s[(($n * 0.25) | ceil) - 1], p50: $s[(($n * 0.5) | ceil) - 1],
            p75: $s[(($n * 0.75) | ceil) - 1], max: $s[$n - 1]}}' \
  >"$results/tier3-raycast-keystroke-manual-$stamp.json"
jq -r '"keystroke-manual: p50 \(.stats.p50) ms (IQR \(.stats.p25)–\(.stats.p75), n \(.stats.n))"' \
  "$results/tier3-raycast-keystroke-manual-$stamp.json"
```

- [ ] **Step 6: Check it**

Run: `d=$(mktemp -d) && bench/probes/manual-keystroke.sh "$d" 120 3 4 5 4 && jq -c '.stats' "$d"/*.json && hk check --all`
Expected: `keystroke-manual: p50 33.333333333333336 ms (IQR 33.333333333333336–41.666666666666664, n 4)`, then
`{"n":4,"min":25,"p25":33.333333333333336,"p50":33.333333333333336,"p75":41.666666666666664,"max":41.666666666666664}`;
hk passes.

- [ ] **Step 7: Commit**

```bash
git add bench/probes/manual-keystroke.sh crates/xtask/src/report.rs
git commit -m "feat(report): Record and show Raycast's manual keystroke timing"
```

---

### Task 5: Dependency depth, coverage, duplication and lint in maintainability

**Files:**

- Modify: `bench/probes/maint.sh` (both halves)
- Modify: `crates/xtask/src/report.rs` (`maintainability`; tests)

- [ ] **Step 1: Write the failing xtask test**

Append to `mod tests` in `crates/xtask/src/report.rs` (it uses `results_with` from Task 4):

```rust
#[test]
fn renders_depth_coverage_duplication_and_lint() {
    let (_dir, results) = results_with(&[
        (
            "maint-ts-20261010T120000Z.json",
            r#"{"deps": {"depth": 10}, "coverage": {"lines": null}, "duplication": {"percent": 2.5},
                "lint": {"clippyWarnings": null}}"#,
        ),
        (
            "maint-rust-20261010T120000Z.json",
            r#"{"deps": {"depth": 7}, "coverage": {"lines": 81.24}, "duplication": {"percent": 0.4},
                "lint": {"clippyWarnings": 0}}"#,
        ),
    ]);
    let out = maintainability(&results).unwrap();
    assert!(out.contains("| Dependency depth | 10 | 7 |"), "{out}");
    assert!(out.contains("| Line coverage | — | 81.2% |"), "{out}");
    assert!(out.contains("| Duplicated lines (jscpd) | 2.5% | 0.4% |"), "{out}");
    assert!(out.contains("| Clippy warnings | — | 0 |"), "{out}");
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cargo nextest run -p xtask renders_depth`
Expected: FAIL — no "Dependency depth" row.

- [ ] **Step 3: Add the rows**

In `maintainability`, after the `seconds` closure add:

```rust
let share = |run: &Run, path: &[&str]| run.number(path).map_or_else(|| "—".into(), |p| format!("{p:.1}%"));
```

and after the "Dependencies, transitive" row add:

```rust
vec![
    "Dependency depth".to_owned(),
    number(&ts, &["deps", "depth"]),
    number(&rust, &["deps", "depth"]),
],
```

and after the "Tests" row add:

```rust
vec![
    "Line coverage".to_owned(),
    share(&ts, &["coverage", "lines"]),
    share(&rust, &["coverage", "lines"]),
],
vec![
    "Duplicated lines (jscpd)".to_owned(),
    share(&ts, &["duplication", "percent"]),
    share(&rust, &["duplication", "percent"]),
],
vec![
    "Clippy warnings".to_owned(),
    number(&ts, &["lint", "clippyWarnings"]),
    number(&rust, &["lint", "clippyWarnings"]),
],
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cargo nextest run -p xtask`
Expected: PASS.

- [ ] **Step 5: Measure them in `maint.sh`**

In `bench/probes/maint.sh`, after the `code()` function add:

```bash
# jscpd's duplicated-lines percentage over <format> files in <paths>, run from tmp so the
# repository's .jscpd.json (thresholds, its own paths) does not apply. Writes only under tmp.
dupes() {
  local format=$1 out
  shift
  out=$PWD/tmp/jscpd-$format
  rm -rf "$out" && mkdir -p "$out"
  (cd "$out" && jscpd --silent --format "$format" --reporters json --output "$out" \
    --ignore '**/node_modules/**,**/target/**,**/dist/**' "$@" >/dev/null) || true
  jq '.statistics.total.percentage' "$out/jscpd-report.json"
}
```

In the TypeScript half, after `ts_direct=…` add:

```bash
# npm reads the installed tree and writes nothing. It cannot scope a Bun workspace to one
# package, so this is the depth of the whole Raycast repo's tree.
ts_depth=$(npm ls --all --json --prefix "$ts" 2>/dev/null |
  jq 'def d: if ((.dependencies // {}) | length) == 0 then 0 else 1 + ([.dependencies[] | d] | max) end; d' ||
  echo null)
```

and change its `jq -n` call: add `--argjson depth "$ts_depth" --argjson dupes "$(dupes typescript,tsx "${ts_paths[@]}")"`
to the arguments, and replace `deps: {direct: $direct, total: null}, tests: $tests,` with

```text
deps: {direct: $direct, total: null, depth: $depth}, tests: $tests,
    coverage: {lines: null}, duplication: {percent: $dupes}, lint: {clippyWarnings: null},
```

and append to its `note`: ` Depth: the whole repo's npm tree. Coverage not measured: the Raycast repo has no Vitest
coverage provider, and nothing here writes to it. No clippy counterpart.`

In the Rust half, after `rs_total=…` add:

```bash
rs_depth=$(cargo tree -p kb-app -e normal --prefix depth --locked | sed -E 's/^([0-9]+).*/\1/' | sort -n | tail -1)
rs_coverage=$(cargo llvm-cov -p kb-domain -p kb-app --json --summary-only --locked 2>/dev/null |
  jq '.data[0].totals.lines.percent')
rs_clippy=$(cargo clippy -p kb-domain -p kb-app --all-targets --locked --message-format json 2>/dev/null |
  jq -s '[.[] | select(.reason == "compiler-message" and .message.level == "warning")] | length')
```

and change its `jq -n` call: add
`--argjson depth "$rs_depth" --argjson coverage "$rs_coverage" --argjson clippy "$rs_clippy" --argjson dupes "$(dupes rust "${rs_paths[@]/#/$PWD/}")"`
to the arguments, and replace `deps: {direct: $direct, total: $total}, tests: $tests,` with

```text
deps: {direct: $direct, total: $total, depth: $depth}, tests: $tests,
    coverage: {lines: $coverage}, duplication: {percent: $dupes}, lint: {clippyWarnings: $clippy},
```

and append to its `note`: ` Coverage: lines of kb-domain and kb-app under cargo llvm-cov (doctests excluded).`

`dupes` runs from `tmp/`, so every path it gets must be absolute: `$ts` already is; the Rust paths are prefixed
with `$PWD/` above.

- [ ] **Step 6: Run it**

Run: `bench/probes/maint.sh tmp --no-build`
Expected: two compact JSON lines; `deps.depth` is 10 (or close) for ts and a small integer for rust, `coverage.lines`
a percentage for rust and `null` for ts, both `duplication.percent` numbers, rust `lint.clippyWarnings` 0. Then
`rm tmp/maint-*.json` (these are not session results).

- [ ] **Step 7: Gate and commit**

Run: `hk check --all && mise run gate --fast`
Expected: pass.

```bash
git add bench/probes/maint.sh crates/xtask/src/report.rs
git commit -m "feat(report): Add dependency depth, coverage, duplication and lint"
```

---

### Task 6: Link `findings.md` from the Verdict

**Files:**

- Modify: `crates/xtask/src/report.rs` (`Inputs`, `render`; tests)
- Modify: `crates/xtask/src/main.rs` (`run`)

- [ ] **Step 1: Write the failing test**

Append to `mod tests` in `crates/xtask/src/report.rs`:

```rust
    fn inputs(findings: bool) -> (tempfile::TempDir, Inputs) {
        let (dir, results) = results_with(&[]);
        let inputs = Inputs {
            results,
            parity: String::new(),
            compliance: String::new(),
            commit: "abc1234".into(),
            verified: false,
            findings,
        };
        (dir, inputs)
    }

    #[test]
    fn links_the_findings_only_when_they_exist() {
        let (_with_dir, with) = inputs(true);
        assert!(render(&with).unwrap().contains("[findings.md](findings.md)"));
        let (_without_dir, without) = inputs(false);
        assert!(!render(&without).unwrap().contains("findings.md"));
    }
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cargo nextest run -p xtask links_the_findings`
Expected: FAIL to compile: `Inputs` has no field `findings`.

- [ ] **Step 3: Add the field and the link**

In `Inputs`, after `verified`:

```rust
/// Whether `docs/experiment/findings.md`, the hand-written reading of the report, exists.
pub findings: bool,
```

In `render`, replace `out += &verdict(&criteria);` with

```rust
out += &verdict(&criteria);
if inputs.findings {
    out += "Why a criterion failed or went unmeasured, what would fix it, and what else the runs \
            showed: [findings.md](findings.md).\n\n";
}
```

In `crates/xtask/src/main.rs`, `run`, add to the `Inputs { … }` literal after `verified,`:

```rust
findings: experiment.join("findings.md").is_file(),
```

- [ ] **Step 4: Run the tests and the fast gate**

Run: `cargo nextest run -p xtask && mise run gate --fast`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/xtask/src/report.rs crates/xtask/src/main.rs
git commit -m "feat(report): Link the findings note from the verdict"
```

---

### Task 7: `bench:cpu`, `bench:size`, preflight and `bench:session`

**Files:**

- Create: `bench/probes/preflight.sh`
- Modify: `mise.toml` (new tasks after `[tasks."bench:maint"]`)

- [ ] **Step 1: Add the preflight**

Create `bench/probes/preflight.sh` (then `chmod +x`):

```bash
#!/usr/bin/env bash
# Checks what a measurement session needs that can be checked from here, prints every miss, and
# fails if there was one. Accessibility permission for the terminal and the kb extension running
# in Raycast are the owner's (docs/experiment/methodology.md, "Session").
# Usage: preflight.sh
set -euo pipefail

missing=()
[ -x tmp/bin/probe ] || missing+=("tmp/bin/probe: run mise run probes")
[ -n "${KB_RAYCAST_HOTKEY:-}" ] ||
  missing+=("KB_RAYCAST_HOTKEY: assign kb Search a hotkey in Raycast and set it in mise.local.toml")
pgrep -x Raycast >/dev/null || missing+=("Raycast is not running")
[ -f "$HOME/.config/raycast/extensions/kb/search.screen.js" ] ||
  missing+=("no kb extension bundle under ~/.config/raycast/extensions/kb: start it in Raycast (owner)")
pmset -g batt | grep -q "AC Power" || missing+=("on battery: plug in AC power")

if [ ${#missing[@]} -eq 0 ]; then
  echo "preflight ok"
  exit 0
fi
printf 'missing: %s\n' "${missing[@]}"
exit 1
```

- [ ] **Step 2: Add the tasks**

In `mise.toml`, after `[tasks."bench:maint"]`:

```toml
[tasks."bench:cpu"]
description = "Tier 2: cold-start CPU time of kb or Raycast, five runs"
depends = ["probes"]
usage = 'arg "<app>" help="kb or raycast"'
run = '''
  #!/usr/bin/env bash
  set -euo pipefail
  case "${usage_app}" in
  kb) mise run package && bench/probes/cpu-rs.sh docs/experiment/results ;;
  raycast) bench/probes/cpu-ts.sh docs/experiment/results ;;
  *) echo "usage: mise run bench:cpu kb|raycast"; exit 2 ;;
  esac
'''

[tasks."bench:size"]
description = "Tier 2: artifact size, kb's stripped binary or Raycast's kb bundle"
usage = 'arg "<app>" help="kb or raycast"'
run = '''
  #!/usr/bin/env bash
  set -euo pipefail
  case "${usage_app}" in
  kb) mise run size ;;
  raycast) bench/probes/size-ts.sh "docs/experiment/results/tier2-ts-size-$(date -u +%Y%m%dT%H%M%SZ).json" ;;
  *) echo "usage: mise run bench:size kb|raycast"; exit 2 ;;
  esac
'''

[tasks."bench:session"]
description = "Every tier 2 and 3 measurement and maintainability, in order, for both apps (methodology, Session)"
depends = ["probes"]
run = '''
  #!/usr/bin/env bash
  set -euo pipefail
  bench/probes/preflight.sh
  mise run bench:home
  for app in kb raycast; do mise run bench:size "$app"; done
  mise run bench:maint
  for app in kb raycast; do mise run bench:memory "$app"; done
  # cpu-ts relaunches Raycast: after memory, so its idle figure is not a fresh launch.
  for app in kb raycast; do mise run bench:cpu "$app"; done
  for app in kb raycast; do mise run bench:e2e "$app"; done
  echo "session done: record the manual keystroke run, commit the results, then mise run report"
'''
```

- [ ] **Step 3: Check**

Run: `hk check --all && mise tasks | grep -E 'bench:(cpu|size|session|home)' && env -u KB_RAYCAST_HOTKEY bench/probes/preflight.sh; echo "exit $?"`
Expected: hk passes; four tasks listed; preflight lists at least the `KB_RAYCAST_HOTKEY` miss and `exit 1`.

- [ ] **Step 4: Commit**

```bash
git add bench/probes/preflight.sh mise.toml
git commit -m "feat(bench): Add cpu, size and session tasks with a preflight"
```

---

### Task 8: Documentation

**Files:**

- Modify: `docs/experiment/methodology.md` (Tier 2, Tier 3, new "Maintainability" and "Session" sections)
- Modify: `docs/superpowers/specs/2026-10-08-kb-native-port-experiment-design.md` (`## Report`)
- Modify: `CONTEXT.md` (Experiment table)
- Modify: `README.md` (Development Workflow)

- [ ] **Step 1: Methodology**

In "Tier 2 — footprint", replace the bullet beginning "kb runs as the packaged `.app`" with:

```markdown
- kb runs as the packaged `.app` (`mise run package`) over `fixtures/private`, through a home whose
  `~/.config/kb/config.toml` points there: `mise run bench:home` builds it in `tmp/bench-home` and syncs its index with
  `kb --sync`. Every kb probe uses it unless `KB_HOME` names another. Its pattern is `kb\.app/Contents/MacOS/kb`.
```

In "Tier 3 — perceived latency", replace the two bullets beginning "**Raycast keystroke → updated list**" and
"Raycast's hotkey is ⌘Space" with:

```markdown
- **Raycast keystroke → updated list** has no signal the probe reads and no trace. It is measured by hand: record the
  screen at 120 fps while typing the last letter of a query, and count frames from the key's echo in the field to the
  list's change, for ten runs at least. `bench/probes/manual-keystroke.sh docs/experiment/results 120 <frames>...`
  records them as `tier3-raycast-keystroke-manual-<stamp>.json`, which the report reads.
- **Raycast's hotkey.** The latency run opens the kb command by its own hotkey, not Raycast's root search: assign kb
  Search a hotkey in Raycast and set it in the gitignored `mise.local.toml` as
  `[env] KB_RAYCAST_HOTKEY = "<keycode> <mods>"` — a macOS virtual keycode (K = 40, Space = 49) and modifiers joined
  by `+`, e.g. `"40 opt+shift"`. The run fails without it.
```

Before "## Baseline history", add:

```markdown
## Maintainability

`bench/probes/maint.sh` (`mise run bench:maint`) counts, for kb search in each implementation: lines of code (tokei),
test files and tests, direct and transitive dependencies, dependency depth (`cargo tree`; for TypeScript `npm ls` over
the whole Raycast repo, which it cannot scope), line coverage (`cargo llvm-cov`; TypeScript's is not measured: the
Raycast repo has no coverage provider and nothing here writes to it), duplicated lines (jscpd, run from `tmp/`), clippy
warnings, and cold and incremental build time. Every number has its scope in the result's `note`.

## Session

Tiers 2 and 3 are measured in one sitting, so both apps see the same machine state.

1. Owner: AC power, heavy apps closed; the terminal has Accessibility permission; Raycast is running with the kb
   extension (as under `ray develop`); `KB_RAYCAST_HOTKEY` is set.
2. `mise run bench:session`: preflight, `bench:home`, size, maintainability, memory, CPU, then latency and ⌘↩, for kb
   and Raycast. It stops at the first failure.
3. Owner: the manual keystroke run (Tier 3), recorded with `manual-keystroke.sh`.
4. Commit the results, then `mise run report`: never `xtask report --verified` by hand, which would claim gates that
   did not run. Uncommitted results make the report cite a `-dirty` commit.
```

- [ ] **Step 2: Amend the experiment spec**

In `docs/superpowers/specs/2026-10-08-kb-native-port-experiment-design.md`, `## Report`, after the numbered list
(before "**Success criteria.**"), add:

```markdown
**Amendment (2026-10-10).** Item 1's charts and item 3's comparison with fallow's health are dropped: the tables carry
the same numbers, and fallow has no Rust counterpart. Item 3 reports dependency depth, Rust line coverage (TypeScript's
is not measured: the Raycast repo has no coverage provider and is never written to), jscpd duplication and the clippy
warning count. Failed or unmeasured criteria are explained in the hand-written `docs/experiment/findings.md`, linked
from the report. Design: `docs/superpowers/specs/2026-10-10-kb-native-05-measurement-and-report-design.md`.
```

- [ ] **Step 3: CONTEXT and README**

In `CONTEXT.md`, Experiment table, after the "Report" row add:

```markdown
| Findings | The hand-written reading of the report: why a criterion failed or went unmeasured, and what would fix it. | `docs/experiment/findings.md` |
```

In `README.md`, `## Development Workflow`, add a paragraph:

```markdown
Measuring both apps is one sitting: set up what `docs/experiment/methodology.md` ("Session") asks, run
`mise run bench:session`, record the manual keystroke run, commit the results, then `mise run report`.
```

- [ ] **Step 4: Format, check and commit**

Run: `dprint fmt && hk check --all`
Expected: pass (dprint realigns the CONTEXT table).

```bash
git add docs/experiment/methodology.md docs/superpowers/specs/2026-10-08-kb-native-port-experiment-design.md CONTEXT.md README.md
git commit -m "docs: Describe the measurement session and amend the report scope"
```

- [ ] **Step 5: Full gate**

Run: `mise run gate`
Expected: every step passes. Hand over to the owner for Task 9.

---

### Task 9: Measurement session (owner at the machine)

**Files:** results only, under `docs/experiment/results/`.

- [ ] **Step 1: Prepare**

Owner: plug in AC power and close heavy apps; grant the terminal Accessibility permission (System Settings → Privacy
& Security → Accessibility); have Raycast running with the kb extension; assign kb Search a hotkey in Raycast and
write it to `mise.local.toml`:

```toml
[env]
KB_RAYCAST_HOTKEY = "40 opt+shift"
```

(Use the hotkey actually assigned.) Do not use ⌥K for it: that is kb's own hotkey.

- [ ] **Step 2: Run the session**

Run: `mise run bench:session`
Expected: "preflight ok"; the `bench:home` sync line; size lines; two maintainability JSON lines; for each memory
scenario `<scenario>: p50 <n> MiB` lines; five `run <n>: <s> s` lines for kb's CPU; the latency summaries
(`show-external: p50 … ms`, and for kb the `*-trace-*` metrics) and `action-copy: p50 … ms` for both apps; finally
"session done: …". Keep hands off the keyboard while it runs.

If a step fails, fix the cause and re-run that app's task alone (for example `mise run bench:e2e raycast`): every
result is a new stamped file, and the report reads the latest of each kind.

- [ ] **Step 3: Check the files**

Run: `ls docs/experiment/results | grep "$(date -u +%Y%m%d)"`
Expected, all stamped today: `tier2-{rust,ts}-size-*`, `maint-{rust,ts}-*`, `tier2-rust-{rss,footprint}-all-{idle,open,after-100-queries}-*`,
`tier2-ts-{rss,footprint}-{all,worker}-{idle,open,after-100-queries}-*`, `tier2-rust-cpu-all-*`, `tier2-ts-cpu-{all,worker}-*`,
`tier3-kb-*`, `tier3-raycast-*`, `tier3-kb-action-*`, `tier3-raycast-action-*`. In `tier3-raycast-*.json`, `hotkey`
equals `KB_RAYCAST_HOTKEY`.

### Task 10: The manual keystroke run, and committing the results (owner)

- [ ] **Step 1: Record**

Owner: record the screen at 120 fps (QuickTime on a ProMotion display, or a phone's slow-motion mode at 120 fps
pointed at the screen), open kb Search with its hotkey, and type a query ten times, the last letter each time on
camera. For each run count frames from the letter's echo in the field to the list's change.

- [ ] **Step 2: Write the result**

Run: `bench/probes/manual-keystroke.sh docs/experiment/results 120 <frames of run 1> … <frames of run 10>`
Expected: `keystroke-manual: p50 <ms> ms (IQR …, n 10)`.

- [ ] **Step 3: Commit the results**

```bash
git add docs/experiment/results
git commit -m "chore(results): Add the tier 2 and tier 3 session results"
```

### Task 11: Report, findings and README summary

**Files:**

- Create: `docs/experiment/findings.md`, `docs/experiment/report.md`
- Modify: `README.md` (new `## Findings` section)

- [ ] **Step 1: Generate a first report to read**

Run: `mise run report`
Expected: the gate and golden parity pass, then "wrote …/docs/experiment/report.md". Read its Verdict: Footprint,
Output parity and Quality now have verdicts; Performance and UI/UX parity keep theirs.

- [ ] **Step 2: Write `docs/experiment/findings.md`**

Hand-written from the report just generated. Sections, each filled with this run's figures and file names:

```markdown
# Findings

What the report of <date> (commit `<hash>`) means. The figures are in [report.md](report.md).

## Verdict

<One paragraph: met or not, and which criteria decided it.>

## Criteria not met or not measured

<For each: the criterion, the measured value against the target, why, and what would fix it — or "None.">

## Observations

<What else the runs showed: e.g. where kb's time goes (trace settle vs debounce), RSS vs physical footprint, cold-start
CPU, size, maintainability trade-offs.>

## Caveats

- `Raycast Backend` hosts every extension, so its worker figure is an upper bound on kb's share.
- Raycast's kb runs as the unminified `ray develop` bundle.
- Raycast's keystroke figure is counted by hand at 120 fps: ±8.3 ms per sample.
- TypeScript coverage is not measured (methodology, "Maintainability").
```

Every `<…>` above is replaced with text from this run before committing; none may remain.

- [ ] **Step 3: Add the README summary**

In `README.md`, after `## Project Name and Description`, add:

```markdown
## Findings

<One sentence: the verdict.> Measured on <date> at commit `<hash>`; method in
[methodology](docs/experiment/methodology.md).

| Measure                                     | Raycast | kb    | Target                 |
| ------------------------------------------- | ------- | ----- | ---------------------- |
| Search p95, median over queries (`private`) | <ms>    | <ms>  | ≥ 2× faster            |
| ⌘↩ → clipboard, p50                         | <ms>    | <ms>  | ≥ 2× faster (or above) |
| RSS after 100 queries                       | <MiB>   | <MiB> | ≤ 50%                  |
| Artifact size                               | <MiB>   | <MiB> | —                      |

Full figures: [report](docs/experiment/report.md). What they mean and what failed: [findings](docs/experiment/findings.md).
```

Fill every `<…>` from the report.

- [ ] **Step 4: Commit findings and README, then generate the final report**

```bash
rm docs/experiment/report.md
dprint fmt docs/experiment/findings.md README.md
git add docs/experiment/findings.md README.md
git commit -m "docs: Add the experiment findings and a README summary"
mise run report
```

Expected: the report's header cites the new `HEAD` without `-dirty`, and the Verdict links `findings.md`.

- [ ] **Step 5: Commit the report**

```bash
git add docs/experiment/report.md
git commit -m "docs(report): Generate the experiment report"
```

### Task 12: Close the plan

- [ ] **Step 1: Check the deliverables**

Run: `grep -c '<' docs/experiment/findings.md; grep -n 'not measured\|-dirty' docs/experiment/report.md; git status --short`
Expected: no `<…>` placeholders left in `findings.md` (any `<` count is from real content only); "not measured" only
for criteria `findings.md` explains; a clean tree.

- [ ] **Step 2: Tick this plan's boxes and commit**

```bash
git add docs/superpowers/plans/2026-10-09-kb-native-05-mvp-compliance-and-report.md
git commit -m "docs(plan5): Mark Plan 5 complete"
```

---

## Self-review against the spec

| Spec item                                         | Task    |
| ------------------------------------------------- | ------- |
| D1 `bench:cpu`, `bench:size`                      | 7       |
| D2 `kb --sync`, `bench:home`, probes use the home | 1, 2    |
| D3 `KB_RAYCAST_HOTKEY`, no ⌘Space default         | 3       |
| D4 manual keystroke result, read by `xtask`       | 4, 10   |
| D5 depth, coverage, duplication, lint; amendment  | 5, 8    |
| D6 `findings.md` link, README `## Findings`       | 6, 11   |
| D7 preflight, `bench:session`, commit then report | 7, 9–11 |
| Testing: CLI unit + integration, xtask units, hk  | 1, 4–6  |
