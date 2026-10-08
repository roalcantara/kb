# kb native port — Plan 1: Bootstrap and Raycast baseline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Rust repository with kb's quality tooling in place from the first commit, plus the measured baseline of
the current Raycast implementation (tier 1 engine numbers, tier 2 footprint) and the golden outputs the port must
reproduce.

**Architecture:** A Cargo workspace with one empty crate (`kb-domain`) so every Rust gate has something real to
check; mise pins every tool and runs every task; hk runs kb's step set ported to Rust. TypeScript scripts in
`bench/ts/` import the Raycast repo's `packages/domain/kb` through a gitignored symlink, are bundled by Bun, and run
under Node 22 (the runtime Raycast ships) and Bun (reference). Private corpora never enter git.

**Tech Stack:** Rust 1.99.0 (edition 2024), Cargo, mise, hk (Pkl), dprint, taplo, typos, ls-lint, ast-grep,
gitleaks, cargo-nextest, cargo-deny, cargo-machete, cargo-llvm-cov, jscpd, mdschema, Bun 1.4, Node 22 and 26,
`node:sqlite`.

**Spec:** [2026-10-08-kb-native-port-experiment-design.md](../specs/2026-10-08-kb-native-port-experiment-design.md)

---

## Roadmap

The spec is delivered by four plans, each ending in working, tested software. Only this one is written in full;
each later plan is written when its predecessor is merged, against the code that then exists.

| Plan | Delivers                                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | This plan: repository, tooling, docs, corpora, TS baseline (tiers 1–2), goldens, UI/UX parity matrix                                      |
| 2    | `kb-domain` at full golden parity, module by module, plus `kb-bench` writing the same results schema                                      |
| 3    | `kb-app`: panel, hotkey, list, filter, split pane, `TextView` notes with highlighting and mermaid, detail, ⌘K actions, sync, size budget   |
| 4    | Tier 2–3 harness on both apps, task cost, `xtask report`, the verdict                                                                     |

## Conventions for every task

- Work in `~/Work/rust/kb`. Every command below runs from that directory unless it says otherwise.
- Commit messages follow kb's commitlint: `type(scope): Sentence case subject` (types: feat, fix, chore, docs,
  style, ref, perf, test, build, ci), ≤ 72 characters, ending with the attribution line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` after a blank line.
- Until Task 6 installs hooks, commit with plain `git commit`. After Task 6, hooks run on every commit; if a hook
  fixes files, review them, `git add` them, and commit again.
- Versions are never typed by hand: `mise use --pin <tool>@latest` resolves and writes them. The only exception is
  Rust, pinned to `1.99.0` to match the toolchain kb already uses.

## File map

| Path                                        | Responsibility                                                              | Task |
| ------------------------------------------- | --------------------------------------------------------------------------- | ---- |
| `Cargo.toml`, `rust-toolchain.toml`         | workspace, lints, release profile; toolchain pin                            | 1    |
| `crates/kb-domain/{Cargo.toml,src/lib.rs}`  | the engine crate, empty until Plan 2                                         | 1    |
| `.gitignore`                                | build output, private corpora, symlinks, tmp                                | 1    |
| `mise.toml`                                 | tool pins, env, tasks                                                       | 2, 7, 9, 11–14 |
| `rustfmt.toml`, `clippy.toml`               | Rust formatting and lint configuration                                      | 3    |
| `dprint.json`, `taplo.toml`, `_typos.toml`  | formatting for Markdown/JSON/TS/shell, TOML; spelling                       | 4    |
| `.ls-lint.yml`, `sgconfig.yml`, `tools/ast-grep/rules/*.yml` | file names; structural code rules                         | 4    |
| `cchk.toml`, `.quick-commitlint.json`, `.gitleaks.toml`, `deny.toml`, `.jscpd.json` | branch/commit hygiene, secrets, supply chain, duplication | 4 |
| `.mdschema.yml`, `tools/mdschema/design.yml`| README and design-spec shapes                                               | 4    |
| `hk.pkl`                                    | hooks and step sets, including `domain-purity` with tests                   | 5    |
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `docs/adr/*` | project documentation                                 | 6    |
| `fixtures/sample/**`                        | committed hand-written corpus covering every notes shape                    | 8    |
| `fixtures/private.sha256`                   | committed manifest of the private corpus                                    | 9    |
| `fixtures/queries.json`                     | the 30 benchmark and golden queries                                         | 10   |
| `bench/ts/{package.json,tsconfig.json}`     | TS bench workspace                                                          | 10   |
| `bench/ts/stats.ts`, `stats.spec.ts`        | nearest-rank statistics                                                     | 10   |
| `bench/ts/corpus.ts`, `corpus.spec.ts`      | corpus resolution and manifest verification                                 | 11   |
| `bench/ts/env.ts`, `measure.ts`, `bench.ts` | environment capture, timing, the tier 1 runner                             | 12   |
| `bench/ts/goldens.ts`                       | golden writer                                                               | 13   |
| `fixtures/sample-goldens/*`                 | committed goldens for the sample corpus                                     | 13   |
| `bench/probes/{rss.sh,drive-queries.sh}`    | tier 2 RSS sampling and scripted typing                                     | 14   |
| `docs/experiment/{methodology.md,parity.md,results/*.json}` | methodology, UI/UX parity matrix, baseline results     | 14, 15 |

---

### Task 1: Cargo workspace skeleton

**Files:**
- Create: `Cargo.toml`, `rust-toolchain.toml`, `crates/kb-domain/Cargo.toml`, `crates/kb-domain/src/lib.rs`,
  `.gitignore`

- [ ] **Step 1: Write the workspace manifest**

`Cargo.toml`:

```toml
[workspace]
resolver = "3"
members = ["crates/kb-domain"]

[workspace.package]
version = "0.1.0"
edition = "2024"
rust-version = "1.99"
license = "MIT"
publish = false
repository = "https://github.com/roalcantara/kb-native"

[workspace.dependencies]

[workspace.lints.rust]
unsafe_code = "forbid"
unused = { level = "deny", priority = -1 }
missing_debug_implementations = "warn"

[workspace.lints.clippy]
pedantic = { level = "warn", priority = -1 }
module_name_repetitions = "allow"
unwrap_used = "warn"
expect_used = "warn"
dbg_macro = "warn"
todo = "warn"
unimplemented = "warn"
print_stdout = "warn"
print_stderr = "warn"

[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
panic = "abort"
strip = true
debug = false
```

`print_stdout`/`print_stderr` are for libraries; a binary crate opts out at its root in Plan 3.

- [ ] **Step 2: Pin the toolchain**

`rust-toolchain.toml`:

```toml
[toolchain]
channel = "1.99.0"
profile = "minimal"
components = ["rustfmt", "clippy", "llvm-tools-preview"]
```

- [ ] **Step 3: Create the engine crate**

`crates/kb-domain/Cargo.toml`:

```toml
[package]
name = "kb-domain"
description = "The kb engine: entries, source files, notes Markdown, the SQLite index and its queries."
version.workspace = true
edition.workspace = true
rust-version.workspace = true
license.workspace = true
publish.workspace = true
repository.workspace = true

[lints]
workspace = true
```

`crates/kb-domain/src/lib.rs`:

```rust
//! The kb engine.
//!
//! A port of `packages/domain/kb` from the Raycast extension: the entry model, source file
//! scanning, notes Markdown, the SQLite index and its queries. It has no UI dependency; the
//! `domain-purity` hk step fails any change that gives it one.

#![warn(missing_docs)]
```

- [ ] **Step 4: Ignore what is built, private or local**

`.gitignore`:

```gitignore
/target/
/tmp/
*.db
*.db-journal
*.db-wal
*.db-shm

# Private corpora and everything derived from them; only fixtures/private.sha256 is committed.
/fixtures/private/
/fixtures/private-10x/
/fixtures/private-goldens/

# The TS bench links to the Raycast repo and bundles locally.
/bench/ts/kb
/bench/ts/node_modules/
/bench/ts/dist/

.DS_Store
```

- [ ] **Step 5: Verify it builds**

Run: `cargo generate-lockfile && cargo build --workspace --locked`

Expected: `Finished`; `Cargo.lock` now exists.

- [ ] **Step 6: Commit**

```bash
git add Cargo.toml Cargo.lock rust-toolchain.toml crates .gitignore
git commit -m "build: Add the Cargo workspace and the kb-domain crate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pin the tools with mise

**Files:**
- Create: `mise.toml`

- [ ] **Step 1: Start the configuration**

`mise.toml`:

```toml
min_version = "2026.9.13"

[env]
# Where the TS bench finds the Raycast implementation. Read only; nothing here writes to it.
KB_TS_REPO = "{{ env.HOME }}/Work/raycast/kb"
# Where the private corpus is copied from. Read only.
KB_SOURCES = "{{ env.HOME }}/.config/kodexb/sources"

[tools]
rust = "1.99.0"
```

- [ ] **Step 2: Resolve and pin every tool**

Run each line; each writes an exact version into `[tools]`:

```bash
mise use --pin cargo-binstall@latest
mise use --pin hk@latest pkl@latest dprint@latest taplo@latest typos@latest ls-lint@latest
mise use --pin shellcheck@latest shfmt@latest actionlint@latest pinact@latest zizmor@latest jq@latest
mise use --pin ast-grep@latest bun@latest
mise use --pin aqua:gitleaks/gitleaks@latest aqua:jackchuka/mdschema@latest
mise use --pin npm:quick-commitlint@latest pipx:commit-check@latest npm:jscpd@latest
mise use --pin cargo:cargo-nextest@latest cargo:cargo-deny@latest cargo:cargo-machete@latest
mise use --pin cargo:cargo-llvm-cov@latest
```

Then add both Node versions by hand: Node 26 runs the tooling, Node 22 is what Raycast runs extensions on. A list
makes the first one the default and installs both:

```toml
node = ["26.11.1", "22.22.2"]
```

Run: `mise install && mise ls --current | wc -l`

Expected: every tool installs; the count equals the number of `[tools]` entries plus one (Node lists two).

- [ ] **Step 3: Add the setup task**

Append to `mise.toml`:

```toml
[tasks.setup]
description = "Install tools, fetch crates, install the TS bench dependencies and the git hooks"
run = '''
  #!/usr/bin/env bash
  set -euo pipefail

  mise install
  cargo fetch --locked
  bun install --cwd bench/ts --frozen-lockfile
  {% if env.CI is defined %}
    echo "CI detected — skipping git hooks"
  {% else %}
    hk install --mise
  {% endif %}
'''
```

`bench/ts` does not exist yet; `mise run setup` is first run in Task 10.

- [ ] **Step 4: Verify the configuration parses**

Run: `mise tasks ls`

Expected: lists `setup`.

- [ ] **Step 5: Commit**

```bash
git add mise.toml $(ls mise.lock 2>/dev/null)
git commit -m "build: Pin the toolchain with mise

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Rust formatting and lint configuration

**Files:**
- Create: `rustfmt.toml`, `clippy.toml`

- [ ] **Step 1: Configure rustfmt**

`rustfmt.toml` (stable options only, so the pinned stable toolchain applies all of them):

```toml
edition = "2024"
max_width = 120
use_field_init_shorthand = true
use_try_shorthand = true
newline_style = "Unix"
```

`max_width = 120` matches kb's `lineWidth`.

- [ ] **Step 2: Configure clippy**

`clippy.toml`:

```toml
# unwrap and expect are lint warnings in production code and allowed in tests, where a panic
# is the assertion failing.
allow-unwrap-in-tests = true
allow-expect-in-tests = true
allow-print-in-tests = true
# cognitive_complexity and too_many_lines stay at clippy's defaults until there is code to measure.
```

- [ ] **Step 3: Verify both gates pass on the skeleton**

Run: `cargo fmt --all --check && cargo clippy --workspace --all-targets --locked -- -D warnings`

Expected: no output from `fmt`; clippy prints `Finished`.

- [ ] **Step 4: Commit**

```bash
git add rustfmt.toml clippy.toml
git commit -m "build: Configure rustfmt and clippy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Hygiene configuration

**Files:**
- Create: `dprint.json`, `taplo.toml`, `_typos.toml`, `.ls-lint.yml`, `sgconfig.yml`,
  `tools/ast-grep/rules/no-process-exit.yml`, `tools/ast-grep/tests/no-process-exit-test.yml`, `cchk.toml`, `.quick-commitlint.json`, `.gitleaks.toml`, `deny.toml`, `.jscpd.json`,
  `.mdschema.yml`, `tools/mdschema/design.yml`

- [ ] **Step 1: dprint for Markdown, JSON, TypeScript and shell**

Run:

```bash
dprint init --config dprint.json <<< ''
dprint config add markdown
dprint config add json
dprint config add typescript
dprint config add exec
```

Then edit `dprint.json` so its non-plugin keys read as below (keep the `plugins` array `dprint config add`
wrote; it holds the resolved versions and checksums):

```json
{
  "lineWidth": 120,
  "indentWidth": 2,
  "markdown": { "lineWidth": 120 },
  "json": { "preferSingleLine": true },
  "typescript": {
    "semiColons": "asi",
    "quoteStyle": "preferSingle",
    "trailingCommas": "never"
  },
  "exec": {
    "commands": [{ "command": "shfmt -i {{indent_width}} --apply-ignore", "exts": ["sh", "bash"] }]
  },
  "excludes": [
    "target/**",
    "tmp/**",
    "fixtures/**",
    "bench/ts/kb",
    "bench/ts/node_modules/**",
    "bench/ts/dist/**",
    "docs/experiment/results/**",
    "**/*.lock",
    "bench/ts/bun.lock"
  ]
}
```

`fixtures/**` is excluded because the corpora and their goldens must stay byte-for-byte as written or generated.

Run: `dprint check`

Expected: exit 0 (fix any reported file with `dprint fmt`).

- [ ] **Step 2: taplo for TOML**

`taplo.toml`:

```toml
exclude = ["target/**", "fixtures/**"]

[formatting]
align_entries = false
indent_string = "  "
reorder_keys = false
array_auto_collapse = true
column_width = 120
```

Run: `taplo fmt --check`

Expected: exit 0 (or run `taplo fmt` once and re-check).

- [ ] **Step 3: typos**

`_typos.toml`:

```toml
[files]
extend-exclude = ["fixtures/", "target/", "bench/ts/kb", "bench/ts/node_modules/", "*.lock", "docs/experiment/results/"]
```

Run: `typos`

Expected: exit 0.

- [ ] **Step 4: ls-lint for file names**

`.ls-lint.yml`:

```yaml
ls:
  .dir: regex:^([a-z0-9-]+|\.github|\.config)$

  # Rust modules are snake_case; crate directories kebab-case.
  crates:
    .dir: kebab-case
  crates/*/src:
    .dir: snake_case
    .rs: snake_case
  crates/*/tests:
    .rs: snake_case
  crates/*/benches:
    .rs: snake_case

  # TS bench: one concept per file, specs keep their suffix.
  bench/ts:
    .ts: regex:^[a-z]+(\.spec)?$

ignore:
  - .git
  - target
  - tmp
  - fixtures
  - bench/ts/kb
  - bench/ts/node_modules
  - bench/ts/dist
  - .ls-lint.yml
```

Run: `ls-lint`

Expected: exit 0.

- [ ] **Step 5: ast-grep with a first Rust rule**

`sgconfig.yml`:

```yaml
ruleDirs:
  - tools/ast-grep/rules
testConfigs:
  - testDir: tools/ast-grep/tests
```

`tools/ast-grep/rules/no-process-exit.yml`:

```yaml
id: no-process-exit
language: rust
severity: error
message: Only a binary's `main` may end the process; return an error instead.
note: |
  `std::process::exit` skips destructors, so an open SQLite transaction or a GPUI window never
  gets to clean up. Libraries and handlers return `Result` and let `main` decide.
rule:
  pattern: std::process::exit($CODE)
  not:
    inside:
      kind: function_item
      has:
        field: name
        regex: ^main$
      stopBy: end
```

`tools/ast-grep/tests/no-process-exit-test.yml`:

```yaml
id: no-process-exit
valid:
  - "fn main() { std::process::exit(1) }"
invalid:
  - "fn helper() { std::process::exit(1) }"
```

Run: `ast-grep test --skip-snapshot-tests && ast-grep scan`

Expected: the test reports `1 passed` or the equivalent for the valid and invalid cases; scan exits 0.

- [ ] **Step 6: Branch and commit hygiene (copied from kb)**

`cchk.toml`:

```toml
[commit]
conventional_commits = true

[branch]
conventional_branch = true
allow_branch_types = ["feature", "feat", "bugfix", "fix", "hotfix", "release", "chore", "ref", "ai", "claude", "codex"]
```

`.quick-commitlint.json`:

```json
{
  "preset": "conventional",
  "rules": {
    "header-max-length": [2, "always", 72],
    "subject-case": [2, "always", "sentence-case"],
    "subject-full-stop": [2, "never", "."],
    "type-enum": [2, "always", ["feat", "fix", "chore", "docs", "style", "ref", "perf", "test", "build", "ci"]]
  }
}
```

- [ ] **Step 7: Secrets**

`.gitleaks.toml`:

```toml
[extend]
useDefault = true

[allowlist]
description = "Build output and local-only corpora"
paths = ['''^target/''', '''^fixtures/private''', '''^bench/ts/kb''']
```

- [ ] **Step 8: Supply chain**

Run: `cargo deny init` then replace the generated `deny.toml` sections with:

```toml
[graph]
all-features = true

[advisories]
version = 2
yanked = "deny"

[licenses]
version = 2
confidence-threshold = 0.9
allow = [
  "MIT",
  "Apache-2.0",
  "Apache-2.0 WITH LLVM-exception",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "Unicode-3.0",
  "Zlib",
  "MPL-2.0",
  "CC0-1.0",
]

[bans]
multiple-versions = "warn"
wildcards = "deny"
allow-wildcard-paths = true

[sources]
unknown-registry = "deny"
unknown-git = "deny"
allow-registry = ["https://github.com/rust-lang/crates.io-index"]
allow-git = []
```

Run: `cargo deny check`

Expected: `advisories ok, bans ok, licenses ok, sources ok`.

- [ ] **Step 9: Duplication**

`.jscpd.json`:

```json
{
  "path": ["crates", "bench/ts"],
  "ignore": ["**/target/**", "bench/ts/kb/**", "bench/ts/node_modules/**", "bench/ts/dist/**"],
  "format": ["rust", "typescript"],
  "threshold": 0,
  "reporters": ["console"],
  "gitignore": true
}
```

Run: `jscpd`

Expected: `Found 0 clones` (or no clones table).

- [ ] **Step 10: Document shapes**

`.mdschema.yml` — the README shape, the same sections as kb's README:

```yaml
structure:
  - heading:
      pattern: '# .*'
    children:
      - heading: '## Project Name and Description'
      - heading: '## Technology Stack'
      - heading: '## Project Architecture'
      - heading: '## Getting Started'
      - heading: '## Project Structure'
      - heading: '## Key Features'
      - heading: '## Development Workflow'
      - heading: '## Coding Standards'
      - heading: '## Testing'
      - heading: '## Contributing'
      - heading: '## License'
        optional: true
```

`tools/mdschema/design.yml` — the shape of `docs/superpowers/specs/*-design.md`:

```yaml
# Patterns are full matches, so each ends in `.*`. Extra sections are allowed: a design names
# what it needs beyond these.
structure:
  - heading:
      pattern: "# .* — design"
      regex: true
    allow_additional: true
    children:
      - heading: "## Goal"
      - heading: "## Decisions"
      - heading: "## Scope"
```

Run: `mdschema check --schema tools/mdschema/design.yml docs/superpowers/specs/2026-10-08-kb-native-port-experiment-design.md`

Expected: exit 0. (`README.md` is checked in Task 6, once it exists.)

- [ ] **Step 11: Commit**

```bash
git add dprint.json taplo.toml _typos.toml .ls-lint.yml sgconfig.yml tools cchk.toml .quick-commitlint.json \
  .gitleaks.toml deny.toml .jscpd.json .mdschema.yml
git commit -m "build: Add formatting, naming, secret and supply-chain checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: hk — kb's step set, ported

**Files:**
- Create: `hk.pkl`

The structure is kb's `hk.pkl`: baseline steps run in every hook; candidate and release steps are profile-gated in
`check`; pre-push runs the slow steps; `check` writes its report to `tmp/hk-report.json`.

- [ ] **Step 1: Write `hk.pkl`**

Use the same Pkl package version kb's `hk.pkl` amends (`v2.0.1`); `min_hk_version` stays at that package's
version.

```pkl
amends "package://github.com/jdx/hk/releases/download/v2.0.1/hk@2.0.1#/Config.pkl"
import "package://github.com/jdx/hk/releases/download/v2.0.1/hk@2.0.1#/Builtins.pkl"

min_hk_version = "2.0.1"

exclude = List("target", ".git", "tmp", "bench/ts/kb", "bench/ts/node_modules", "bench/ts/dist")
display_skip_reasons = List()
terminal_progress = false
fail_fast = false

local binary_excludes = List(
    "*.png", "*.jpg", "*.jpeg", "*.gif", "*.webp", "*.ico",
    "*.woff", "*.woff2", "*.ttf", "*.eot", "*.pdf", "*.zip"
)

// Corpora and goldens are authored or generated byte for byte: one owner each, never a formatter.
local generated = List("fixtures/**/*", "docs/experiment/results/**/*")

// Rust sources and the manifests that decide what they compile against.
local rust_inputs = List("**/*.rs", "**/Cargo.toml", "Cargo.lock", "rust-toolchain.toml", "clippy.toml")

local structure_steps = new Mapping<String, Step> {
  // kb-domain is the engine and must not reach the UI. Rust already forbids the cycle
  // kb-app -> kb-domain -> kb-app, but nothing stops kb-domain from depending on gpui
  // directly or through a helper crate, and once it does, the engine benchmarks measure a
  // UI toolkit. This step is the one owner of that direction, as raycast-manifest-parity is
  // in kb.
  //
  // Globbed to kb-domain's manifest: its dependencies change only there. The workspace root
  // is derived from the manifest's own path, so the tests can build their own workspace
  // under {{tmp}}. --offline: `mise run setup` fetches every crate, so resolution never
  // needs the network, and the tests use path dependencies alone.
  ["domain-purity"] = new Step {
    glob = List("crates/kb-domain/Cargo.toml")
    shell = "bash -o pipefail -c"
    check = """
      status=0
      for manifest in {{files}}; do
        [[ -f "$manifest" ]] || continue
        root=$(cd "$(dirname "$manifest")/../.." && pwd)
        if ! tree=$(cargo tree --offline --manifest-path "$root/Cargo.toml" -p kb-domain \\
            --edges normal,build --prefix none --format '{p}' 2>&1); then
          echo "$tree"
          status=1
          continue
        fi
        bad=$(printf '%s\\n' "$tree" | awk '{print $1}' | grep -E '^(gpui([-_].*)?|kb-app)$' | sort -u || true)
        if [[ -n "$bad" ]]; then
          echo "kb-domain must not depend on UI crates, but reaches:"
          printf '    %s\\n' $bad
          echo "    -> move the UI-dependent code into kb-app"
          status=1
        fi
      done
      exit $status
      """
    tests {
      ["accepts a domain with no UI dependency"] {
        run = "check"
        files = List("{{tmp}}/crates/kb-domain/Cargo.toml")
        write {
          ["{{tmp}}/Cargo.toml"] = """
            [workspace]
            resolver = "3"
            members = ["crates/*"]
            """
          ["{{tmp}}/crates/kb-domain/Cargo.toml"] = """
            [package]
            name = "kb-domain"
            version = "0.1.0"
            edition = "2024"
            """
          ["{{tmp}}/crates/kb-domain/src/lib.rs"] = ""
          ["{{tmp}}/crates/gpui/Cargo.toml"] = """
            [package]
            name = "gpui"
            version = "0.1.0"
            edition = "2024"
            """
          ["{{tmp}}/crates/gpui/src/lib.rs"] = ""
        }
        expect { code = 0 }
      }
      ["rejects a direct gpui dependency"] {
        run = "check"
        files = List("{{tmp}}/crates/kb-domain/Cargo.toml")
        write {
          ["{{tmp}}/Cargo.toml"] = """
            [workspace]
            resolver = "3"
            members = ["crates/*"]
            """
          ["{{tmp}}/crates/kb-domain/Cargo.toml"] = """
            [package]
            name = "kb-domain"
            version = "0.1.0"
            edition = "2024"

            [dependencies]
            gpui = { path = "../gpui" }
            """
          ["{{tmp}}/crates/kb-domain/src/lib.rs"] = ""
          ["{{tmp}}/crates/gpui/Cargo.toml"] = """
            [package]
            name = "gpui"
            version = "0.1.0"
            edition = "2024"
            """
          ["{{tmp}}/crates/gpui/src/lib.rs"] = ""
        }
        expect {
          code = 1
          stdout = "kb-domain must not depend on UI crates"
        }
      }
      ["rejects gpui reached through another crate"] {
        run = "check"
        files = List("{{tmp}}/crates/kb-domain/Cargo.toml")
        write {
          ["{{tmp}}/Cargo.toml"] = """
            [workspace]
            resolver = "3"
            members = ["crates/*"]
            """
          ["{{tmp}}/crates/kb-domain/Cargo.toml"] = """
            [package]
            name = "kb-domain"
            version = "0.1.0"
            edition = "2024"

            [dependencies]
            helper = { path = "../helper" }
            """
          ["{{tmp}}/crates/kb-domain/src/lib.rs"] = ""
          ["{{tmp}}/crates/helper/Cargo.toml"] = """
            [package]
            name = "helper"
            version = "0.1.0"
            edition = "2024"

            [dependencies]
            gpui-kit = { path = "../gpui-kit" }
            """
          ["{{tmp}}/crates/helper/src/lib.rs"] = ""
          ["{{tmp}}/crates/gpui-kit/Cargo.toml"] = """
            [package]
            name = "gpui-kit"
            version = "0.1.0"
            edition = "2024"
            """
          ["{{tmp}}/crates/gpui-kit/src/lib.rs"] = ""
        }
        expect {
          code = 1
          stdout = "gpui-kit"
        }
      }
    }
  }

  // Design specs keep one shape so the plan that reads one can rely on its sections.
  ["design-specs"] = new Step {
    glob = List("docs/superpowers/specs/*-design.md")
    shell = "bash -o pipefail -c"
    check = """
      status=0
      for file in {{files}}; do
        [[ -f "$file" ]] || continue
        mdschema check --schema tools/mdschema/design.yml "$file" || status=1
      done
      exit $status
      """
  }
}

local baseline_steps = new Mapping<String, Step> {
    ...structure_steps
    ["newlines"] = (Builtins.newlines) {
        exclude = binary_excludes + generated
    }
    ["trailing-whitespace"] = (Builtins.trailing_whitespace) {
        exclude = binary_excludes + generated
    }
    ["merge-conflict"] = Builtins.check_merge_conflict
    ["mixed-line-ending"] = (Builtins.mixed_line_ending) {
        exclude = generated
    }
    ["large-files"] = Builtins.check_added_large_files

    ["private-key"] = Builtins.detect_private_key
    ["gitleaks"] = (Builtins.gitleaks) {
        check = "gitleaks dir --redact --verbose --no-banner --log-level error {{files}}"
        exclude = binary_excludes
    }

    ["pkl"] = Builtins.pkl
    ["mise"] = Builtins.mise
    ["dprint"] = Builtins.dprint
    ["shellcheck"] = Builtins.shellcheck
    ["actionlint"] = Builtins.actionlint
    ["pinact"] = Builtins.pinact
    ["typos"] = (Builtins.typos) {
        exclude = binary_excludes + generated + List("*.lock")
    }
    ["docs"] = (Builtins.mdschema) {
        glob = List("README.md")
    }
    ["paths"] {
        check = "ls-lint"
    }
    ["branch"] {
        check = "cchk --branch"
    }

    // Rust: formatter, compiler, linter. The compiler and clippy see the whole workspace,
    // because a change to one crate can break another.
    ["rustfmt"] = Builtins.cargo_fmt
    ["taplo"] {
        glob = List("**/*.toml")
        check = "taplo fmt --check {{files}}"
        fix = "taplo fmt {{files}}"
    }
    ["cargo-check"] {
        glob = rust_inputs
        check = "cargo check --workspace --all-targets --locked"
    }
    ["clippy"] {
        glob = rust_inputs
        check = "cargo clippy --workspace --all-targets --locked -- -D warnings"
    }
    ["ast-grep"] {
        glob = List("**/*.rs", "tools/ast-grep/**/*.yml", "sgconfig.yml")
        check = "ast-grep test --skip-snapshot-tests && ast-grep scan"
    }
    ["machete"] {
        glob = List("**/Cargo.toml")
        check = "cargo machete"
    }
    ["dupes"] {
        glob = List("**/*.rs", "bench/ts/*.ts")
        check = "jscpd"
    }

    // The TS bench is code too: typecheck it with the compiler its own package pins.
    ["bench-ts-typecheck"] {
        glob = List("bench/ts/*.ts", "bench/ts/tsconfig.json", "bench/ts/package.json")
        check = "bun run --cwd bench/ts typecheck"
    }
}

// Slow checks. Defined once, spread profile-free into pre-push and profile-gated into `check`.
//
// --no-tests=warn: kb-domain has no tests until Plan 2. Plan 2's first task removes the flag,
// so an empty test run cannot pass silently once tests exist.
local push_steps = new Mapping<String, Step> {
    ["test"] {
        check = "cargo nextest run --workspace --locked --no-tests=warn"
    }
    ["bench-ts-test"] {
        check = "bun test --cwd bench/ts"
    }
    ["build"] {
        check = "cargo build --workspace --release --locked"
    }
}

// Everything a change needs before it is fit to propose.
local candidate_steps = new Mapping<String, Step> {
    ...(push_steps) {
        ["test"] { profiles = List("candidate") }
        ["bench-ts-test"] { profiles = List("candidate") }
        ["build"] { profiles = List("candidate") }
    }
    ["rustdoc"] {
        check = "RUSTDOCFLAGS='-D warnings' cargo doc --workspace --no-deps --locked"
        profiles = List("candidate")
    }
    ["coverage"] {
        // A report, not a gate: there is no threshold until Plan 2 has code to measure.
        check = "cargo llvm-cov nextest --workspace --locked --no-tests=warn --summary-only"
        profiles = List("candidate")
    }
}

// Security and provenance: the concerns that matter once code ships.
local release_steps = new Mapping<String, Step> {
    ["gitleaks-release"] {
        profiles = List("release")
        check = "gitleaks git --redact --no-banner --config=.gitleaks.toml"
    }
    ["cargo-deny"] {
        profiles = List("release")
        check = "cargo deny check"
    }
    ["zizmor"] = (Builtins.zizmor) {
        profiles = List("release")
    }
}

local precommit_steps = new Mapping<String, Step> {
    ...(baseline_steps) {
        ["gitleaks"] = (Builtins.gitleaks) {
            // Pre-commit scans the staged index itself, so a secret cannot slip through a
            // glob that stopped matching.
            check = "gitleaks git --pre-commit --redact --staged --verbose --no-banner --log-level error"
        }
    }
}

local all_steps = new Mapping<String, Step> {
    ...baseline_steps
    ...candidate_steps
    ...release_steps
}

local commit_message_steps = new Mapping<String, Step> {
    ["conventional-commit"] {
        check = #"""
            {% raw %}
            f="{% endraw %}{{commit_msg_file}}{% raw %}"
            case "$(grep -v '^#' "$f" | sed -e '/./,$!d' | head -1)" in
                Merge\ *|Revert\ *|Reapply\ *|fixup!\ *|squash!\ *|amend!\ *) exit 0 ;;
            esac
            exec quick-commitlint --config .quick-commitlint.json "$f"
            {% endraw %}
            """#
    }
}

hooks {
    ["pre-commit"] {
        fix = true
        stash = "git"
        steps = precommit_steps
    }
    ["commit-msg"] {
        steps = commit_message_steps
    }
    ["pre-push"] {
        steps = push_steps
    }
    ["fix"] {
        fix = true
        steps = baseline_steps
    }
    ["check"] {
        // Steps that matched no files are absent from HK_REPORT_JSON; a later audit can diff
        // that against the declared set to catch a check that stopped checking anything.
        report = "mkdir -p tmp && printf '%s' \"$HK_REPORT_JSON\" > tmp/hk-report.json"
        steps = all_steps
    }
}
```

The `bench-ts-*` steps refer to `bench/ts`, created in Task 10; until then they match no files (typecheck) or are
not run (pre-push is not triggered before Task 10's push).

- [ ] **Step 2: Validate the configuration**

Run: `hk validate`

Expected: no errors. If a `Builtins.<name>` does not exist in the pinned package, replace that one step with an
explicit `check` command for the same tool, as `taplo` and `clippy` are written above.

- [ ] **Step 3: Run the domain-purity tests**

Run: `hk test --step domain-purity`

Expected: three tests pass: accepts a domain with no UI dependency, rejects a direct gpui dependency, rejects gpui
reached through another crate.

- [ ] **Step 4: Run the step on the real repository**

Run: `hk check --step domain-purity --all`

Expected: exit 0 — `kb-domain` has no dependencies.

- [ ] **Step 5: Commit**

```bash
git add hk.pkl
git commit -m "build: Port kb's hk step set to Rust

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Documentation

**Files:**
- Create: `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `docs/adr/0001-gpui-kit.md`,
  `docs/adr/0002-sqlite-schema-parity.md`, `docs/adr/0003-native-mermaid.md`,
  `docs/adr/0004-resident-panel-and-hotkey.md`

- [ ] **Step 1: README**

`README.md`:

````markdown
# kb native

## Project Name and Description

kb native is an experiment: a native macOS port of the [kb](https://github.com/roalcantara/kb) Raycast extension's
knowledge-base search, written in Rust on [GPUI Kit](https://gpui-kit.com), and measured against the original. Its
deliverable is a report that says, with numbers, whether a native port is worth having once Raycast's extension
size and runtime limits are out of the way.

## Technology Stack

- Rust 1.99 (edition 2024), Cargo workspace
- GPUI Kit for the UI (from Plan 3)
- SQLite with FTS5 through `rusqlite`, the same schema as the Raycast extension (from Plan 2)
- mise for tool versions and tasks; hk for git hooks and quality steps
- Bun and Node 22 for the TypeScript baseline benchmarks

## Project Architecture

| Crate / folder        | Role                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `crates/kb-domain`    | The engine: entries, source files, notes Markdown, the SQLite index and its queries. No UI.   |
| `crates/kb-app`       | The GPUI Kit application: a resident panel opened by a global hotkey. (Plan 3)                 |
| `crates/kb-bench`     | Engine benchmarks writing the shared results schema. (Plan 2)                                 |
| `bench/ts`            | The same benchmarks over the Raycast extension's TypeScript engine.                            |
| `fixtures`            | Benchmark corpora, queries and golden outputs.                                                 |

`kb-domain` never depends on a UI crate; the `domain-purity` hk step enforces it. See [CONTEXT.md](CONTEXT.md)
for the domain vocabulary and [docs/adr](docs/adr) for the decisions.

## Getting Started

```bash
mise run setup        # tools, crates, TS bench dependencies, git hooks
mise run gate         # every quality gate, stopping at the first failure
```

The TS baseline reads the Raycast repository at `$KB_TS_REPO` (default `~/Work/raycast/kb`) and never writes to
it.

## Project Structure

```text
crates/          Rust crates
bench/ts/        TypeScript baseline benchmarks and golden writer
bench/probes/    footprint probes (RSS, scripted typing)
fixtures/        corpora, queries, goldens (private corpora are gitignored)
docs/adr/        architecture decisions
docs/experiment/ methodology, parity matrix, results, report
docs/superpowers/ design specs and implementation plans
tools/           ast-grep rules, mdschema schemas
```

## Key Features

- The kb search experience — FTS search, filters, split pane, rendered notes, actions, sync — as a native app.
- Byte-for-byte parity with the Raycast engine's output, proven by golden tests.
- A reproducible benchmark of both implementations on the same corpus.

## Development Workflow

| Command                  | Does                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| `mise run setup`         | install everything                                                |
| `mise run gate`          | all gates in order; `--fast` runs tests and clippy only           |
| `mise run fixtures`      | copy the private corpus, verify its manifest, build the 10× copy  |
| `mise run goldens`       | write goldens from the TS engine                                  |
| `mise run bench:ts`      | tier 1 benchmarks of the TS engine                                |
| `hk check --all`         | every baseline step over the whole repository                     |

Commits follow Conventional Commits with a sentence-case subject; hk checks the message.

## Coding Standards

- The Rust best practices in `~/.agents/skills/rust-best-practices`, and the GPUI Kit Coding and Design Guides.
- Typed errors (`thiserror`) in libraries; no `unwrap`, `expect`, printing or `process::exit` outside tests and
  `main`.
- One concept per file, named after it; a folder carries context.
- Use the vocabulary in [CONTEXT.md](CONTEXT.md).

## Testing

```bash
cargo nextest run --workspace   # Rust tests
bun test --cwd bench/ts         # TS bench helpers
```

Golden tests compare the Rust engine with the TypeScript one. `fixtures/sample-goldens` is committed and runs
everywhere; the private corpus's goldens stay local.

## Contributing

Work through a design spec in `docs/superpowers/specs` and a plan in `docs/superpowers/plans`. Every change passes
`mise run gate`.

## License

MIT
````

Run: `mdschema check README.md`

Expected: exit 0.

- [ ] **Step 2: Agent instructions**

`CLAUDE.md`:

```markdown
@AGENTS.md
@CONTEXT.md
```

`AGENTS.md`:

````markdown
# AGENTS.md

## Project overview

An experiment: a native Rust port of the kb Raycast extension's search command, on GPUI Kit, measured against the
original. The design is [docs/superpowers/specs/2026-10-08-kb-native-port-experiment-design.md][spec]; plans live
in `docs/superpowers/plans/`.

[spec]: docs/superpowers/specs/2026-10-08-kb-native-port-experiment-design.md

## Repository map

- `crates/kb-domain/`: the engine; no UI dependency
- `crates/kb-app/`: the GPUI Kit application (Plan 3)
- `crates/kb-bench/`: engine benchmarks (Plan 2)
- `bench/ts/`: the TypeScript baseline; imports the Raycast repo through the gitignored `bench/ts/kb` symlink
- `fixtures/`: corpora, queries, goldens
- `docs/`: ADRs, experiment, specs and plans

## Core engineering rules

- `kb-domain` must never depend on `gpui*` or `kb-app`, directly or transitively. The `domain-purity` hk step
  enforces it; do not bypass it.
- Follow `~/.agents/skills/rust-best-practices`, and for UI work read the GPUI Kit Coding Guides
  (`~/.agents/skills/gpui-kit`) and Design Guides (`~/.agents/skills/gpui-kit-design-guides`) before deciding.
- Never commit anything from or derived from the private corpus: `fixtures/private*` is gitignored and must stay
  so. Only `fixtures/private.sha256` is committed.
- Never write to the Raycast repository (`$KB_TS_REPO`).
- Keep quality gates and thresholds unchanged unless the owner approves the change.

## Naming conventions

- Rust files and modules snake_case, one concept per file; crate directories kebab-case.
- No `mod.rs` + sibling file for the same module; prefer `module.rs` with `module/` children.
- Use the domain vocabulary in [CONTEXT.md](CONTEXT.md).

## Setup

```bash
mise run setup
```

## Validation

```bash
mise run gate
```

It runs, in order, stopping at the first failure: `cargo nextest run`, `cargo clippy -D warnings`,
`cargo build --release`, `hk check --all`, `cargo deny check`, `cargo doc -D warnings`.

## Testing expectations

- Write the failing test first. Tests sit beside the code in `#[cfg(test)]` modules; integration tests in
  `crates/*/tests/`.
- Engine behaviour is checked against goldens from the TypeScript engine, never against hand-copied expectations.

## Commits

Conventional Commits with a sentence-case subject, at most 72 characters.
````

- [ ] **Step 3: Vocabulary**

`CONTEXT.md`:

```markdown
# Context

The domain words of this repository, each with where it lives. They are kb's words; code, specs and prompts use
them and no synonyms. Locations marked *(Plan N)* do not exist yet.

| Term              | Meaning                                                                                                                       | Lives in                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Entry             | One knowledge node users can search and open: a YAML key under an entry type. Its id is `<rel path>#<type>#<key>`.            | `crates/kb-domain/src/entry.rs` *(Plan 2)*       |
| Entry type        | The top-level YAML key an entry sits under (`commands`, `bookmarks`, `tasks`…). Unknown keys are kept, not rejected.          | `crates/kb-domain/src/entry_type.rs` *(Plan 2)*  |
| Sources directory | Where source files are found, recursively: `sources_path` in `~/.config/kb/config.toml`, else `~/.config/kodexb/sources`.     | `crates/kb-app/src/config.rs` *(Plan 3)*         |
| Source file       | A `.yml` or `.yaml` file under the sources directory; the only source of truth, never written.                                | `crates/kb-domain/src/source.rs` *(Plan 2)*      |
| Primary content   | What an entry's main action opens or copies: its `url`, `cmd`, `cheat` or `task` field, else its key.                          | `crates/kb-domain/src/entry.rs` *(Plan 2)*       |
| Tags              | An entry's `tags` (or `tag`) labels, lowercased. Filterable; not in the full-text index.                                      | `crates/kb-domain/src/entry.rs` *(Plan 2)*       |
| Index             | `kb.db`: `entries`, the `entries_fts` FTS5 table, `entry_tags` — the Raycast schema, in the app's own support directory.       | `crates/kb-domain/src/sync.rs` *(Plan 2)*        |
| Index row         | The SQLite projection of one entry, including the pre-compiled notes Markdown.                                                | `crates/kb-domain/src/row.rs` *(Plan 2)*         |
| Notes             | An entry's documentation in whatever shape its source file used; compiled to Markdown at sync time.                           | `crates/kb-domain/src/markdown.rs` *(Plan 2)*    |
| Query             | The search text plus the filter and page window. Each word becomes an FTS5 prefix term; results are ordered by rank.         | `crates/kb-domain/src/query.rs` *(Plan 2)*       |
| Filter            | The entry types and tags a query is narrowed to: any selected type, and every selected tag.                                   | `crates/kb-domain/src/search.rs` *(Plan 2)*      |
| Sync              | The manual rebuild of the index from the source files; cancellable, transactional.                                            | `crates/kb-domain/src/sync.rs` *(Plan 2)*        |
| Sync report       | What a sync says about each source file: entries indexed, entries skipped, or why the file failed to parse.                   | `crates/kb-domain/src/report.rs` *(Plan 2)*      |
| Panel             | The floating window the hotkey opens; hidden on Esc or when it loses focus.                                                   | `crates/kb-app/src/panel.rs` *(Plan 3)*          |
| Hotkey            | The global key combination that shows the panel.                                                                              | `crates/kb-app/src/hotkey.rs` *(Plan 3)*         |

## Experiment

| Term        | Meaning                                                                                                    | Lives in                          |
| ----------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Corpus      | A set of source files a run measures: `sample` (committed), `private` and `private-10x` (local only).     | `fixtures/`, `bench/ts/corpus.ts` |
| Golden      | An output of the TypeScript engine the Rust engine must reproduce.                                         | `fixtures/*-goldens/`             |
| Tier        | A measurement depth: 1 engine, 2 footprint, 3 perceived latency.                                           | `docs/experiment/methodology.md`  |
| Result      | One run's JSON, in the shared schema, under `docs/experiment/results/`.                                   | `bench/ts/bench.ts`               |
| Parity row  | One user-visible behaviour of the Raycast command and its status in the port.                              | `docs/experiment/parity.md`       |
```

`entry_type.rs` rather than `type.rs`: `type` is a Rust keyword.

- [ ] **Step 4: ADRs**

`docs/adr/0001-gpui-kit.md`:

```markdown
# 0001. GPUI Kit for the native UI

- Status: accepted
- Date: 2026-10-08

## Context

The port must reproduce Raycast's list, split pane, rendered Markdown with highlighted code, action palette and
navigation, natively and small. GPUI Kit (the `gpui-kit` crate) ships a virtualized `List`, `TextView` (Markdown
and HTML with an opt-in code highlighter), `Command`, `Popover`, `Resizable`, `NavStack`, `DescriptionList`,
`Tag`, `Kbd`, `Empty` and `Notification`.

## Decision

Build `kb-app` on GPUI Kit, pinned to one exact version.

## Consequences

Every Raycast surface maps to a GPUI Kit component except the global hotkey and the launcher panel (ADR 0004).
API churn is contained by the exact pin; upgrades are deliberate.
```

`docs/adr/0002-sqlite-schema-parity.md`:

```markdown
# 0002. Keep the Raycast index schema

- Status: accepted
- Date: 2026-10-08

## Context

Comparing search speed and results is only meaningful if both engines query the same data the same way.

## Decision

`kb-domain` creates the same `entries`, `entries_fts` (FTS5 over title, description, notes) and `entry_tags`
tables with the same SQL, through `rusqlite` with its bundled SQLite. The database is the app's own file; the
Raycast index is never opened.

## Consequences

Ranking can be compared with goldens. Results with equal rank have no defined order — SQLite builds differ
between Node, Bun and `rusqlite` — so golden comparisons treat a run of equal sort keys as a set.
```

`docs/adr/0003-native-mermaid.md`:

```markdown
# 0003. Render mermaid natively

- Status: accepted
- Date: 2026-10-08

## Context

The TypeScript engine turns a `mermaid` notes block into an image served by `mermaid.ink`: it needs the network
and sends the diagram source to a third party.

## Decision

The Markdown keeps the TypeScript engine's output byte for byte. `kb-app` renders those image references, when
they point at `mermaid.ink`, with the `merman` crate instead, offline.

## Consequences

Diagrams render offline and privately. `merman` adds to the binary; its size is reported separately.
```

`docs/adr/0004-resident-panel-and-hotkey.md`:

```markdown
# 0004. A resident panel opened by a global hotkey

- Status: accepted
- Date: 2026-10-08

## Context

Raycast keeps running and shows kb in a floating panel. A port launched as an ordinary app would compare its cold
start with Raycast's warm one.

## Decision

`kb-app` runs resident without a Dock icon, registers a global hotkey with the `global-hotkey` crate, and shows a
GPUI pop-up window that hides on Esc or when it loses focus. Both live in `main`, `panel` and `hotkey` alone.

## Consequences

Tier 3 compares warm with warm. The hotkey is the only piece outside GPUI Kit.
```

- [ ] **Step 5: Verify the documents**

Run: `dprint check && typos && mdschema check README.md`

Expected: exit 0 for each (run `dprint fmt` for formatting-only failures).

- [ ] **Step 6: Commit**

```bash
git add README.md AGENTS.md CLAUDE.md CONTEXT.md docs/adr
git commit -m "docs: Add the README, agent guide, vocabulary and ADRs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The gate

**Files:**
- Modify: `mise.toml` (append)

- [ ] **Step 1: Add the gate task**

Append to `mise.toml`:

```toml
[tasks.gate]
description = "Run every quality gate, stopping at the first failure. --fast runs tests and clippy only."
usage = 'flag "--fast" help="nextest and clippy only, for inner loops"'
run = '''
  #!/usr/bin/env bash
  set -euo pipefail

  cargo nextest run --workspace --locked --no-tests=warn
  cargo clippy --workspace --all-targets --locked -- -D warnings
  if [ "${usage_fast:-false}" = "true" ]; then exit 0; fi
  cargo build --workspace --release --locked
  hk check --all
  cargo deny check
  RUSTDOCFLAGS='-D warnings' cargo doc --workspace --no-deps --locked
'''
```

- [ ] **Step 2: Install the hooks and run the gate**

Run: `hk install --mise && mise run gate`

Expected: every command succeeds; `hk check --all` lists each baseline step as passed or skipped (no files).
`bench-ts-typecheck` is skipped: `bench/ts` does not exist yet.

- [ ] **Step 3: Commit**

```bash
git add mise.toml
git commit -m "build: Add the gate task

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: the pre-commit and commit-msg hooks run and pass.

---

### Task 8: The sample corpus

**Files:**
- Create: `fixtures/sample/bookmarks.yml`, `fixtures/sample/commands.yml`, `fixtures/sample/cheats.yml`,
  `fixtures/sample/notes.yml`, `fixtures/sample/tasks.yml`, `fixtures/sample/misc/snippets.yaml`,
  `fixtures/sample/errors/broken.yml`, `fixtures/sample/errors/list-type.yml`

Every shape the TypeScript engine handles appears at least once: each primary-content field and the key fallback;
`desc` and `description`; `tags` as a list and `tag` as a string; links as strings and as `title: url` maps;
notes as a string, a list of strings and `lang: code` maps, and a `lang: code` map; every special language
(`md`, `mermaid`, `svg`, `img`), aliases (`sh`, `ts`, `yml`, `py`), an unknown language, and non-string code; a
YouTube bookmark; task status and priority, and a status on a non-task that must be ignored; a non-map entry
(skipped); an unknown entry type in a nested folder with a `.yaml` extension; a YAML syntax error; a type block
that is a list; and non-ASCII text.

- [ ] **Step 1: Write the files**

`fixtures/sample/bookmarks.yml`:

```yaml
bookmarks:
  https://www.youtube.com/watch?v=aqz-KE-bpKQ:
    title: A conference talk
    desc: A YouTube bookmark, so its notes open with the video thumbnail.
    tags: [video, Talks]
  https://example.com/docs:
    title: Example docs
    description: Uses the long spelling of the description field.
    tag: docs
    status: archived
    links:
      - https://example.com/changelog
      - Guide: https://example.com/guide
        API: https://example.com/api
  not-a-map: a bookmark whose value is a string, so it is skipped
```

`fixtures/sample/commands.yml`:

```yaml
commands:
  docker ps -a:
    desc: List every container, stopped ones too.
    tags: [docker, containers]
    notes: |
      Add `--format '{{.Names}}'` to print names only.
  kubectl get pods -A:
    title: All pods
    tags: [kube]
    notes:
      - Lists pods in every namespace.
      - sh: kubectl get pods -A -o wide
      - yml: |
          apiVersion: v1
          kind: Pod
  run-script:
    cmd: ./scripts/run.sh --verbose
    title: Run with the explicit cmd field
```

`fixtures/sample/cheats.yml`:

```yaml
cheats:
  git-rebase:
    title: Interactive rebase
    cheat: git rebase -i HEAD~3
    tags: [git]
    notes:
      md: |
        ## Steps

        1. Pick the first commit
        2. Squash the rest

        | Key | Meaning |
        | --- | ------- |
        | p   | pick    |
        | s   | squash  |
      ts: "const answer: number = 42"
      json:
        retries: 3
        hosts: [a, b]
      mermaid: |
        graph TD
          A[Start] --> B[Rebase]
      svg: <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>
      img: https://example.com/diagram.png
      haskell: main = putStrLn "unknown language, kept as written"
      py: print("alias for python")
```

`fixtures/sample/notes.yml`:

```yaml
notes:
  plain-note:
    title: Café ☕ notes
    notes: Plain string notes with **bold** text and naïve Unicode.
  without-notes:
    title: A note without notes
  list-notes:
    title: List notes
    notes:
      - First paragraph.
      - python: print("hello")
      - 42
```

`fixtures/sample/tasks.yml`:

```yaml
tasks:
  port-engine:
    task: Port the kb engine to Rust
    status: in-progress
    priority: high
    tags: [rust, kb]
  write-report:
    title: Write the report
    status: todo
```

`fixtures/sample/misc/snippets.yaml`:

```yaml
snippets:
  hello:
    title: An entry of an unknown type
    tag: Mixed-Case
    notes: Unknown types are kept, not rejected.
```

`fixtures/sample/errors/broken.yml`:

```yaml
commands:
  echo hi:
    desc: [this flow sequence is never closed
```

`fixtures/sample/errors/list-type.yml`:

```yaml
commands:
  - a list where a map of entries belongs
  - so the whole file is rejected
```

- [ ] **Step 2: Confirm the TypeScript engine reads it as intended**

Run (needs the symlink from Task 10 Step 3 — create it now if absent):

```bash
mkdir -p bench/ts tmp && ln -sfn "$KB_TS_REPO/packages/domain/kb" bench/ts/kb
cat > tmp/probe.ts <<'EOF'
import { scanKnowledgeBase } from '../bench/ts/kb/src/source'
const r = scanKnowledgeBase(process.argv[2]!)
console.log(r.entries.length, 'entries;', r.errors.length, 'errors')
for (const e of r.errors) console.log('error:', e.filePath.split('/').slice(-2).join('/'), '-', e.message.split('\n')[0])
EOF
bun tmp/probe.ts fixtures/sample
```

Expected: `12 entries; 2 errors`, the errors being `errors/broken.yml` (a YAML syntax error) and
`errors/list-type.yml` (`type block "commands" is a list`). The skipped `not-a-map` is not an entry.

- [ ] **Step 3: Commit**

```bash
git add fixtures/sample
git commit -m "test: Add the sample corpus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The private corpus

**Files:**
- Create: `fixtures/private.sha256`
- Modify: `mise.toml` (append)

- [ ] **Step 1: Add the fixtures task**

Append to `mise.toml`:

```toml
[tasks.fixtures]
description = "Copy the private corpus from $KB_SOURCES (--refresh), verify it against fixtures/private.sha256, and build the 10x copy"
usage = 'flag "--refresh" help="recopy from $KB_SOURCES and rewrite the manifest"'
run = '''
  #!/usr/bin/env bash
  set -euo pipefail

  manifest() { (cd fixtures/private && find . -type f \( -name '*.yml' -o -name '*.yaml' \) | LC_ALL=C sort | xargs shasum -a 256); }

  if [ "${usage_refresh:-false}" = "true" ]; then
    rm -rf fixtures/private
    mkdir -p fixtures/private
    # -L: the sources directory is a symlink, and so may be its folders.
    rsync -aL --include='*/' --include='*.yml' --include='*.yaml' --exclude='*' --prune-empty-dirs \
      "$KB_SOURCES/" fixtures/private/
    manifest > fixtures/private.sha256
    echo "copied $(wc -l < fixtures/private.sha256 | tr -d ' ') files; review and commit fixtures/private.sha256"
  fi

  if ! diff -q <(manifest) fixtures/private.sha256 >/dev/null; then
    echo "fixtures/private does not match fixtures/private.sha256"
    echo "    -> run 'mise run fixtures --refresh' to take a new snapshot, or restore the old one"
    exit 1
  fi

  rm -rf fixtures/private-10x
  for i in 0 1 2 3 4 5 6 7 8 9; do
    mkdir -p "fixtures/private-10x/copy-$i"
    cp -R fixtures/private/. "fixtures/private-10x/copy-$i/"
  done
  echo "private corpus verified; private-10x rebuilt"
'''
```

- [ ] **Step 2: Take the snapshot**

Run: `mise run fixtures --refresh`

Expected: `copied 69 files; …` then `private corpus verified; private-10x rebuilt`.

- [ ] **Step 3: Prove nothing private is staged**

Run: `git status --porcelain fixtures`

Expected: exactly one untracked path, `?? fixtures/private.sha256`. If `fixtures/private/` or
`fixtures/private-10x/` appears, stop: `.gitignore` is wrong.

- [ ] **Step 4: Prove drift is caught**

Run: `echo '# drift' >> fixtures/private/agile.yml; mise run fixtures; echo "exit=$?"; sed -i '' '$ d' fixtures/private/agile.yml; mise run fixtures`

Expected: the first run prints `fixtures/private does not match …` and `exit=1`; after the line is removed, the
second run passes.

- [ ] **Step 5: Commit the manifest only**

```bash
git add mise.toml fixtures/private.sha256
git commit -m "test: Snapshot the private corpus by manifest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: TS bench workspace and statistics

**Files:**
- Create: `bench/ts/package.json`, `bench/ts/tsconfig.json`, `bench/ts/stats.ts`, `bench/ts/stats.spec.ts`,
  `fixtures/queries.json`
- Modify: `mise.toml` (append)

- [ ] **Step 1: Create the package**

`bench/ts/package.json`:

```json
{
  "name": "kb-bench-ts",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit -p .",
    "build": "bun build bench.ts goldens.ts --target=node --outdir dist --entry-naming [name].mjs"
  }
}
```

Run: `bun add --cwd bench/ts -d typescript @types/node @types/bun`

Expected: `bench/ts/bun.lock` is written and the three packages appear under `devDependencies` with exact
resolved versions.

`bench/ts/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node", "bun"]
  },
  "include": ["*.ts"]
}
```

- [ ] **Step 2: Add the link task**

Append to `mise.toml`:

```toml
[tasks."bench:link"]
description = "Point bench/ts/kb at the Raycast repo's packages/domain/kb (read only)"
run = '''
  #!/usr/bin/env bash
  set -euo pipefail
  target="$KB_TS_REPO/packages/domain/kb"
  [ -d "$target/src" ] || { echo "no TS engine at $target; set KB_TS_REPO"; exit 1; }
  ln -sfn "$target" bench/ts/kb
  echo "bench/ts/kb -> $target @ $(git -C "$KB_TS_REPO" rev-parse --short HEAD)"
'''
```

- [ ] **Step 3: Run setup end to end**

Run: `mise run bench:link && mise run setup`

Expected: the link line prints the Raycast repo's commit; setup completes.

- [ ] **Step 4: Write the failing statistics tests**

`bench/ts/stats.spec.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { percentile, summarize } from './stats'

describe('percentile', () => {
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1)

  test('is nearest-rank: the smallest sample with at least p% at or below it', () => {
    expect(percentile(hundred, 50)).toBe(50)
    expect(percentile(hundred, 95)).toBe(95)
    expect(percentile(hundred, 99)).toBe(99)
    expect(percentile(hundred, 100)).toBe(100)
  })

  test('rounds the rank up on small sets', () => {
    expect(percentile([10, 20, 30], 50)).toBe(20)
    expect(percentile([10, 20, 30], 95)).toBe(30)
  })

  test('returns the only sample for any p', () => {
    expect(percentile([7], 1)).toBe(7)
    expect(percentile([7], 99)).toBe(7)
  })

  test('rejects an empty sample set', () => {
    expect(() => percentile([], 50)).toThrow(RangeError)
  })
})

describe('summarize', () => {
  test('sorts before reading percentiles and reports the mean', () => {
    expect(summarize([30, 10, 20, 40])).toEqual({ n: 4, min: 10, p50: 20, p95: 40, p99: 40, max: 40, mean: 25 })
  })

  test('rejects an empty sample set', () => {
    expect(() => summarize([])).toThrow(RangeError)
  })
})
```

- [ ] **Step 5: Run them to see them fail**

Run: `bun test --cwd bench/ts`

Expected: FAIL — `Cannot find module './stats'`.

- [ ] **Step 6: Implement the statistics**

`bench/ts/stats.ts`:

```ts
/** A sample set reduced to the figures every result reports. Units are the samples' own. */
export interface Stats {
  readonly n: number
  readonly min: number
  readonly p50: number
  readonly p95: number
  readonly p99: number
  readonly max: number
  readonly mean: number
}

/**
 * The nearest-rank percentile of samples sorted ascending: the smallest sample with at least
 * `p` percent of the set at or below it. No interpolation, so every figure reported is a time
 * that was actually measured. kb-bench (Plan 2) implements the same definition.
 */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new RangeError('percentile of an empty sample set')
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length))
  return sorted[Math.min(rank, sorted.length) - 1] as number
}

export function summarize(samples: readonly number[]): Stats {
  if (samples.length === 0) throw new RangeError('summary of an empty sample set')
  const sorted = [...samples].sort((a, b) => a - b)
  const sum = sorted.reduce((acc, value) => acc + value, 0)
  return {
    n: sorted.length,
    min: sorted[0] as number,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] as number,
    mean: sum / sorted.length
  }
}
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `bun test --cwd bench/ts`

Expected: 6 pass, 0 fail.

- [ ] **Step 8: Write the queries**

`fixtures/queries.json` — the 30 queries every benchmark and golden run uses. `limit` is the app's `PAGE_SIZE`
(50) everywhere; the one `offset` is the second page:

```json
[
  { "id": "q01-empty", "text": "" },
  { "id": "q02-empty-type", "text": "", "types": ["commands"] },
  { "id": "q03-empty-tag", "text": "", "tags": ["git"] },
  { "id": "q04-one-letter", "text": "d" },
  { "id": "q05-two-letters", "text": "do" },
  { "id": "q06-prefix", "text": "dock" },
  { "id": "q07-word", "text": "docker" },
  { "id": "q08-word-page-2", "text": "docker", "offset": 50 },
  { "id": "q09-two-words", "text": "docker run" },
  { "id": "q10-three-words", "text": "docker container rm" },
  { "id": "q11-git", "text": "git" },
  { "id": "q12-git-rebase", "text": "git rebase" },
  { "id": "q13-kube", "text": "kube" },
  { "id": "q14-kubectl-pods", "text": "kubectl get pods" },
  { "id": "q15-aws", "text": "aws" },
  { "id": "q16-aws-s3", "text": "aws s3" },
  { "id": "q17-react", "text": "react" },
  { "id": "q18-vite", "text": "vite" },
  { "id": "q19-python", "text": "python" },
  { "id": "q20-ruby", "text": "ruby" },
  { "id": "q21-leetcode", "text": "leetcode" },
  { "id": "q22-zsh", "text": "zsh" },
  { "id": "q23-ssh", "text": "ssh" },
  { "id": "q24-mise", "text": "mise" },
  { "id": "q25-fabric", "text": "fabric" },
  { "id": "q26-word-type", "text": "git", "types": ["commands"] },
  { "id": "q27-word-two-types", "text": "docker", "types": ["commands", "cheats"] },
  { "id": "q28-word-tag", "text": "aws", "tags": ["serverless"] },
  { "id": "q29-word-type-tag", "text": "kube", "types": ["commands"], "tags": ["kube"] },
  { "id": "q30-no-match", "text": "zzqxj" }
]
```

- [ ] **Step 9: Commit**

```bash
git add mise.toml bench/ts/package.json bench/ts/bun.lock bench/ts/tsconfig.json bench/ts/stats.ts \
  bench/ts/stats.spec.ts fixtures/queries.json
git commit -m "test: Add the TS bench workspace, statistics and queries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Corpus resolution and verification

**Files:**
- Create: `bench/ts/corpus.ts`, `bench/ts/corpus.spec.ts`

- [ ] **Step 1: Write the failing tests**

`bench/ts/corpus.spec.ts`:

```ts
import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { manifestOf, resolveCorpus } from './corpus'

const roots: string[] = []
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'corpus-'))
  roots.push(root)
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return root
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('manifestOf', () => {
  test('lists YAML files only, sorted, in shasum format', () => {
    const root = tree({ 'b.yml': 'b: 1\n', 'a/c.yaml': 'c: 1\n', 'notes.txt': 'ignored' })
    const lines = manifestOf(root).trimEnd().split('\n')
    expect(lines.map(line => line.split('  ')[1])).toEqual(['./a/c.yaml', './b.yml'])
    expect(lines[0]).toMatch(/^[0-9a-f]{64} {2}\.\/a\/c\.yaml$/)
  })
})

describe('resolveCorpus', () => {
  test('accepts a corpus that matches its manifest', () => {
    const fixtures = tree({ 'private/a.yml': 'a: 1\n' })
    writeFileSync(join(fixtures, 'private.sha256'), manifestOf(join(fixtures, 'private')))
    const corpus = resolveCorpus('private', fixtures)
    expect(corpus.files).toBe(1)
    expect(corpus.digest).toMatch(/^[0-9a-f]{64}$/)
  })

  test('rejects a corpus that drifted from its manifest', () => {
    const fixtures = tree({ 'private/a.yml': 'a: 1\n' })
    writeFileSync(join(fixtures, 'private.sha256'), manifestOf(join(fixtures, 'private')))
    writeFileSync(join(fixtures, 'private/a.yml'), 'a: 2\n')
    expect(() => resolveCorpus('private', fixtures)).toThrow(/does not match/)
  })

  test('verifies the 10x corpus through the manifest of its source', () => {
    const fixtures = tree({ 'private/a.yml': 'a: 1\n', 'private-10x/copy-0/a.yml': 'a: 1\n' })
    writeFileSync(join(fixtures, 'private.sha256'), manifestOf(join(fixtures, 'private')))
    expect(resolveCorpus('private-10x', fixtures).files).toBe(1)
  })

  test('needs no manifest for the committed sample', () => {
    const fixtures = tree({ 'sample/a.yml': 'a: 1\n' })
    expect(resolveCorpus('sample', fixtures).files).toBe(1)
  })

  test('rejects an unknown corpus name', () => {
    expect(() => resolveCorpus('other', tree({}))).toThrow(/unknown corpus/)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `bun test --cwd bench/ts corpus`

Expected: FAIL — `Cannot find module './corpus'`.

- [ ] **Step 3: Implement corpus resolution**

`bench/ts/corpus.ts`:

```ts
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/** A corpus a run measures, identified by a digest so results can prove which one they used. */
export interface Corpus {
  readonly name: 'sample' | 'private' | 'private-10x'
  readonly root: string
  /** SHA-256 of the corpus manifest (the private manifest for both private corpora). */
  readonly digest: string
  readonly files: number
}

const NAMES = ['sample', 'private', 'private-10x'] as const

function yamlFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.ya?ml$/.test(entry.name))
    .map(entry => join(entry.parentPath, entry.name))
}

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * The manifest of a directory in `shasum -a 256` format: one `<hash>  ./<path>` line per YAML
 * file, sorted bytewise by path — the same text the `fixtures` mise task writes.
 */
export function manifestOf(dir: string): string {
  const lines = yamlFiles(dir)
    .map(file => `./${relative(dir, file)}`)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map(path => `${sha256(readFileSync(join(dir, path)))}  ${path}`)
  return lines.length === 0 ? '' : `${lines.join('\n')}\n`
}

/**
 * Resolves a corpus under `fixturesDir` and, for the private ones, refuses to return a corpus
 * that no longer matches `private.sha256`: a benchmark of a drifted corpus is not comparable.
 */
export function resolveCorpus(name: string, fixturesDir: string): Corpus {
  if (!(NAMES as readonly string[]).includes(name)) {
    throw new Error(`unknown corpus "${name}"; expected one of ${NAMES.join(', ')}`)
  }
  const corpusName = name as Corpus['name']
  const root = resolve(fixturesDir, corpusName)
  const files = yamlFiles(corpusName === 'private-10x' ? join(root, 'copy-0') : root).length

  if (corpusName === 'sample') {
    return { name: corpusName, root, digest: sha256(manifestOf(root)), files }
  }

  const expected = readFileSync(join(fixturesDir, 'private.sha256'), 'utf8')
  const actual = manifestOf(join(fixturesDir, 'private'))
  if (actual !== expected) {
    throw new Error('fixtures/private does not match fixtures/private.sha256; run `mise run fixtures`')
  }
  return { name: corpusName, root, digest: sha256(expected), files }
}
```

`files` counts one copy for `private-10x`: it is the corpus's distinct file count; results report the scale
separately by name.

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test --cwd bench/ts`

Expected: 12 pass, 0 fail.

- [ ] **Step 5: Confirm the manifest format matches the shell's**

Run: `bun -e "import { manifestOf } from './bench/ts/corpus'; process.stdout.write(manifestOf('fixtures/private'))" | diff - fixtures/private.sha256 && echo same`

Expected: `same`.

- [ ] **Step 6: Commit**

```bash
git add bench/ts/corpus.ts bench/ts/corpus.spec.ts
git commit -m "test: Resolve and verify benchmark corpora

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: The tier 1 runner

**Files:**
- Create: `bench/ts/env.ts`, `bench/ts/measure.ts`, `bench/ts/measure.spec.ts`, `bench/ts/query.ts`,
  `bench/ts/bench.ts`
- Modify: `mise.toml` (append)

The runner measures the TypeScript engine on the same cases Plan 2 measures in Rust. Search is measured twice:
`search-app` follows the extension's real path — `@raycast/utils`' `executeSQL` opens a read-only connection per
query, runs the rendered SQL, closes, and the hook maps each row through `indexRowToEntry`, which re-parses its
YAML — and `search-engine` runs the same statement on one open connection, the floor the engine allows.

- [ ] **Step 1: Write the failing measurement tests**

`bench/ts/measure.spec.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { measure, measureAsync } from './measure'

describe('measure', () => {
  test('runs warmup and sample iterations and records one sample each', () => {
    let calls = 0
    const result = measure('count', { warmup: 3, samples: 5 }, () => {
      calls++
    })
    expect(calls).toBe(8)
    expect(result.name).toBe('count')
    expect(result.unit).toBe('ns')
    expect(result.samples).toHaveLength(5)
    expect(result.stats.n).toBe(5)
  })

  test('runs setup before every iteration, outside the timed span', () => {
    const order: string[] = []
    measure('order', { warmup: 1, samples: 1, setup: () => order.push('setup') }, () => {
      order.push('run')
    })
    expect(order).toEqual(['setup', 'run', 'setup', 'run'])
  })
})

describe('measureAsync', () => {
  test('awaits each iteration before timing the next', async () => {
    let active = 0
    let maxActive = 0
    await measureAsync('serial', { warmup: 1, samples: 3 }, async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await Bun.sleep(1)
      active--
    })
    expect(maxActive).toBe(1)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `bun test --cwd bench/ts measure`

Expected: FAIL — `Cannot find module './measure'`.

- [ ] **Step 3: Implement measurement**

`bench/ts/measure.ts`:

```ts
import { type Stats, summarize } from './stats'

/** One measured case: every sample, in nanoseconds, and their summary. */
export interface CaseResult {
  readonly name: string
  readonly unit: 'ns'
  readonly samples: readonly number[]
  readonly stats: Stats
}

export interface MeasureOptions {
  readonly warmup: number
  readonly samples: number
  /** Runs before every iteration and is not timed: resetting state, deleting a database. */
  readonly setup?: () => void
}

function now(): bigint {
  return process.hrtime.bigint()
}

export function measure(name: string, options: MeasureOptions, run: () => unknown): CaseResult {
  for (let i = 0; i < options.warmup; i++) {
    options.setup?.()
    run()
  }
  const samples: number[] = []
  for (let i = 0; i < options.samples; i++) {
    options.setup?.()
    const start = now()
    run()
    samples.push(Number(now() - start))
  }
  return { name, unit: 'ns', samples, stats: summarize(samples) }
}

export async function measureAsync(
  name: string,
  options: MeasureOptions,
  run: () => Promise<unknown>
): Promise<CaseResult> {
  for (let i = 0; i < options.warmup; i++) {
    options.setup?.()
    await run()
  }
  const samples: number[] = []
  for (let i = 0; i < options.samples; i++) {
    options.setup?.()
    const start = now()
    await run()
    samples.push(Number(now() - start))
  }
  return { name, unit: 'ns', samples, stats: summarize(samples) }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun test --cwd bench/ts`

Expected: 15 pass, 0 fail.

- [ ] **Step 5: Environment capture**

`bench/ts/env.ts`:

```ts
import { execFileSync } from 'node:child_process'

/** Where and with what a result was produced, so two results can be judged comparable. */
export interface RunEnv {
  readonly date: string
  readonly cpu: string
  readonly model: string
  readonly os: string
  readonly power: string
  readonly runtime: string
  readonly sqlite: string
  readonly tsRepoCommit: string
  readonly repoCommit: string
}

function read(command: string, args: readonly string[]): string {
  try {
    return execFileSync(command, args, { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

export function captureEnv(sqliteVersion: string, tsRepo: string): RunEnv {
  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined'
  return {
    date: new Date().toISOString(),
    cpu: read('sysctl', ['-n', 'machdep.cpu.brand_string']),
    model: read('sysctl', ['-n', 'hw.model']),
    os: `macOS ${read('sw_vers', ['-productVersion'])}`,
    // "Now drawing from 'AC Power'" -> AC Power. Battery runs are slower and flagged in the report.
    power: read('pmset', ['-g', 'batt']).match(/'([^']+)'/)?.[1] ?? 'unknown',
    runtime: isBun ? `bun-${process.versions.bun}` : `node-${process.versions.node}`,
    sqlite: sqliteVersion,
    tsRepoCommit: read('git', ['-C', tsRepo, 'rev-parse', 'HEAD']),
    repoCommit: read('git', ['rev-parse', 'HEAD'])
  }
}
```

- [ ] **Step 6: Query loading, shared by the runner and the goldens**

`bench/ts/query.ts`:

```ts
import { readFileSync } from 'node:fs'
import type { SearchQuery } from './kb/src/search'

/** One entry of fixtures/queries.json. */
export interface BenchQuery {
  readonly id: string
  readonly text: string
  readonly types?: readonly string[]
  readonly tags?: readonly string[]
  readonly offset?: number
}

/** The app's PAGE_SIZE: every query asks for one page. */
export const PAGE_SIZE = 50

export function loadQueries(path: string): readonly BenchQuery[] {
  return JSON.parse(readFileSync(path, 'utf8')) as BenchQuery[]
}

export function toSearchQuery(query: BenchQuery): SearchQuery {
  const hasFilter = (query.types?.length ?? 0) > 0 || (query.tags?.length ?? 0) > 0
  return {
    text: query.text,
    limit: PAGE_SIZE,
    offset: query.offset ?? 0,
    ...(hasFilter ? { filter: { types: query.types ?? [], tags: query.tags ?? [] } } : {})
  }
}
```

- [ ] **Step 7: The runner**

`bench/ts/bench.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import type { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { resolveCorpus } from './corpus'
import { captureEnv } from './env'
import { buildEntryMarkdown } from './kb/src/markdown'
import { type IndexRow, indexRowToEntry } from './kb/src/row'
import { buildSearchSql, renderSearchSql } from './kb/src/search'
import { scanKnowledgeBase } from './kb/src/source'
import { syncKnowledgeBase } from './kb/src/sync'
import { type CaseResult, measure, measureAsync } from './measure'
import { loadQueries, toSearchQuery } from './query'

const SCHEMA_VERSION = 1

function arg(name: string): string {
  const index = process.argv.indexOf(`--${name}`)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (value === undefined) throw new Error(`missing --${name}`)
  return value
}

const sqlite = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite')

function openReadOnly(path: string): DatabaseSync {
  // What @raycast/utils' executeSQL does for every query.
  const db = new sqlite.DatabaseSync(path, { open: false, readOnly: true })
  db.open()
  return db
}

async function main(): Promise<void> {
  const fixtures = resolve(arg('fixtures'))
  const corpus = resolveCorpus(arg('corpus'), fixtures)
  const out = resolve(arg('out'))
  const queries = loadQueries(join(fixtures, 'queries.json'))
  const work = mkdtempSync(join(tmpdir(), 'kb-bench-'))
  const database = join(work, 'kb.db')
  const removeDatabase = (): void => {
    for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(`${database}${suffix}`, { force: true })
  }
  const cases: CaseResult[] = []

  try {
    const scanned = scanKnowledgeBase(corpus.root)
    cases.push(measure('scan', { warmup: 3, samples: 20 }, () => scanKnowledgeBase(corpus.root)))
    cases.push(measure('markdown', { warmup: 3, samples: 20 }, () => {
      for (const entry of scanned.entries) buildEntryMarkdown(entry)
    }))
    cases.push(await measureAsync('sync-cold', { warmup: 2, samples: 10, setup: removeDatabase }, () =>
      syncKnowledgeBase(corpus.root, database)))
    cases.push(await measureAsync('sync-warm', { warmup: 2, samples: 10 }, () =>
      syncKnowledgeBase(corpus.root, database)))

    const connection = openReadOnly(database)
    const sqliteVersion = (connection.prepare('SELECT sqlite_version() AS v').get() as { v: string }).v
    try {
      for (const query of queries) {
        const statement = buildSearchSql(toSearchQuery(query))
        const rendered = renderSearchSql(statement)
        cases.push(measure(`search-app/${query.id}`, { warmup: 20, samples: 200 }, () => {
          const db = openReadOnly(database)
          try {
            const rows = db.prepare(rendered).all() as unknown as IndexRow[]
            return rows.map(indexRowToEntry)
          } finally {
            db.close()
          }
        }))
        const prepared = connection.prepare(statement.sql)
        cases.push(measure(`search-engine/${query.id}`, { warmup: 50, samples: 500 }, () =>
          prepared.all(...statement.params)))
      }
    } finally {
      connection.close()
    }

    const result = {
      schema: SCHEMA_VERSION,
      tier: 1,
      implementation: 'ts',
      corpus: { name: corpus.name, digest: corpus.digest, files: corpus.files, entries: scanned.entries.length },
      env: captureEnv(sqliteVersion, process.env.KB_TS_REPO ?? ''),
      cases
    }
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`)
    console.log(`${cases.length} cases -> ${out}`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

await main()
```

`KB_TS_REPO` is set by the mise environment, which every task runs in.

- [ ] **Step 8: The bench task**

Append to `mise.toml`:

```toml
[tasks."bench:ts"]
description = "Tier 1: benchmark the TS engine on a corpus under Node 22 (Raycast's runtime) and Bun"
depends = ["bench:link"]
usage = 'arg "<corpus>" help="sample, private or private-10x"'
run = '''
  #!/usr/bin/env bash
  set -euo pipefail
  corpus="${usage_corpus}"
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  bun run --cwd bench/ts build
  node22=$(mise where node@22.22.2)/bin/node
  "$node22" bench/ts/dist/bench.mjs --fixtures fixtures --corpus "$corpus" \
    --out "docs/experiment/results/tier1-ts-node22-$corpus-$stamp.json"
  bun bench/ts/bench.ts --fixtures fixtures --corpus "$corpus" \
    --out "docs/experiment/results/tier1-ts-bun-$corpus-$stamp.json"
'''
```

- [ ] **Step 9: Typecheck and smoke-run on the sample**

Run: `bun run --cwd bench/ts typecheck && mise run bench:ts sample`

Expected: no type errors; two lines `64 cases -> docs/experiment/results/tier1-ts-…-sample-….json`
(4 engine cases + 2 × 30 search cases).

- [ ] **Step 10: Check a result**

Run: `jq '{runtime: .env.runtime, sqlite: .env.sqlite, entries: .corpus.entries, scan_p50_ms: (.cases[0].stats.p50 / 1e6)}' docs/experiment/results/tier1-ts-node22-sample-*.json`

Expected: `runtime` starts with `node-22.`, `entries` is `12`, `scan_p50_ms` is a small positive number.

- [ ] **Step 11: Commit (code only; sample results are smoke output)**

```bash
rm docs/experiment/results/tier1-ts-*-sample-*.json
git add bench/ts/env.ts bench/ts/measure.ts bench/ts/measure.spec.ts bench/ts/query.ts bench/ts/bench.ts mise.toml
git commit -m "test: Benchmark the TS engine at tier 1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Goldens

**Files:**
- Create: `bench/ts/goldens.ts`, `fixtures/sample-goldens/rows.jsonl`, `fixtures/sample-goldens/summary.json`,
  `fixtures/sample-goldens/queries.json`
- Modify: `mise.toml` (append)

Goldens are written by Node 22, the runtime Raycast uses. Absolute paths are replaced with `<root>` so goldens
compare across machines. `durationMs` is dropped: it is not an output.

- [ ] **Step 1: The golden writer**

`bench/ts/goldens.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { resolveCorpus } from './corpus'
import type { IndexRow } from './kb/src/row'
import { buildFtsPrefixQuery } from './kb/src/query'
import { buildSearchSql } from './kb/src/search'
import { syncKnowledgeBase } from './kb/src/sync'
import { loadQueries, toSearchQuery } from './query'

function arg(name: string): string {
  const index = process.argv.indexOf(`--${name}`)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (value === undefined) throw new Error(`missing --${name}`)
  return value
}

/** Replaces every occurrence of the corpus root, so a golden reads the same on every machine. */
function portable<T>(value: T, root: string): T {
  const escaped = JSON.stringify(root).slice(1, -1)
  return JSON.parse(JSON.stringify(value).replaceAll(escaped, '<root>')) as T
}

const sqlite = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite')

async function main(): Promise<void> {
  const fixtures = resolve(arg('fixtures'))
  const corpus = resolveCorpus(arg('corpus'), fixtures)
  const out = resolve(arg('out'))
  const work = mkdtempSync(join(tmpdir(), 'kb-goldens-'))
  const database = join(work, 'kb.db')

  try {
    const { durationMs: _, ...summary } = await syncKnowledgeBase(corpus.root, database)
    const db = new sqlite.DatabaseSync(database, { readOnly: true })
    try {
      const rows = db.prepare('SELECT * FROM entries ORDER BY id').all() as unknown as IndexRow[]

      const queries = loadQueries(join(fixtures, 'queries.json')).map(query => {
        const statement = buildSearchSql(toSearchQuery(query))
        const results = db.prepare(statement.sql).all(...statement.params) as unknown as IndexRow[]
        const fts = buildFtsPrefixQuery(query.text)
        // The sort key the statement ordered by: FTS rank, or the title when there is no text.
        const ranks = new Map<string, number>()
        if (fts !== '') {
          const ranked = db
            .prepare('SELECT e.id AS id, fts.rank AS rank FROM entries_fts(?) fts JOIN entries e ON e.rowid = fts.rowid')
            .all(fts) as { id: string; rank: number }[]
          for (const { id, rank } of ranked) ranks.set(id, rank)
        }
        return {
          ...query,
          results: results.map(row => ({ id: row.id, sortKey: fts === '' ? row.title : ranks.get(row.id) }))
        }
      })

      mkdirSync(out, { recursive: true })
      writeFileSync(join(out, 'rows.jsonl'), rows.map(row => JSON.stringify(portable(row, corpus.root))).join('\n') + '\n')
      writeFileSync(join(out, 'summary.json'), `${JSON.stringify(portable(summary, corpus.root), null, 2)}\n`)
      writeFileSync(join(out, 'queries.json'), `${JSON.stringify(queries, null, 2)}\n`)
      console.log(`${rows.length} rows, ${queries.length} queries -> ${out}`)
    } finally {
      db.close()
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

await main()
```

- [ ] **Step 2: The goldens task**

Append to `mise.toml`:

```toml
[tasks.goldens]
description = "Write goldens from the TS engine under Node 22 into fixtures/<corpus>-goldens"
depends = ["bench:link"]
usage = 'arg "<corpus>" help="sample or private"'
run = '''
  #!/usr/bin/env bash
  set -euo pipefail
  bun run --cwd bench/ts build
  "$(mise where node@22.22.2)/bin/node" bench/ts/dist/goldens.mjs \
    --fixtures fixtures --corpus "${usage_corpus}" --out "fixtures/${usage_corpus}-goldens"
'''
```

- [ ] **Step 3: Generate the sample goldens**

Run: `mise run goldens sample`

Expected: `12 rows, 30 queries -> …/fixtures/sample-goldens`.

- [ ] **Step 4: Prove they are deterministic and portable**

Run:

```bash
cp -R fixtures/sample-goldens tmp/sample-goldens-1
mise run goldens sample
diff -r tmp/sample-goldens-1 fixtures/sample-goldens && echo deterministic
grep -c "$HOME" fixtures/sample-goldens/* || echo portable
```

Expected: `deterministic`, then the grep prints `0` per file followed by `portable`.

- [ ] **Step 5: Read the goldens against the corpus**

Run: `jq -c '{id, notes_md_start: .notes_markdown[0:40]}' fixtures/sample-goldens/rows.jsonl | head -5; jq '{totalIndexed, filesFailed, errors: [.errors[].message | split("\n")[0]]}' fixtures/sample-goldens/summary.json`

Expected: ids such as `bookmarks.yml#bookmarks#https://example.com/docs`; `totalIndexed` 12, `filesFailed` 2, and
the two error messages from Task 8.

- [ ] **Step 6: Generate the private goldens (local only)**

Run: `mise run fixtures && mise run goldens private && git status --porcelain fixtures`

Expected: `4233 rows, 30 queries -> …/fixtures/private-goldens` (the count may differ if the corpus changed since
this plan was written; it must equal the TS engine's sync count), and `git status` shows only
`?? fixtures/sample-goldens/` — nothing private.

- [ ] **Step 7: Commit the sample goldens**

```bash
git add bench/ts/goldens.ts mise.toml fixtures/sample-goldens
git commit -m "test: Write goldens from the TS engine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: The Raycast baseline — tier 1 and tier 2

**Files:**
- Create: `bench/probes/rss.sh`, `bench/probes/drive-queries.sh`, `docs/experiment/methodology.md`,
  `docs/experiment/results/*.json`

- [ ] **Step 1: Run tier 1 on both private corpora**

Plug the Mac into power, close other heavy apps, then run:

```bash
mise run fixtures
mise run bench:ts private
mise run bench:ts private-10x
ls docs/experiment/results/
```

Expected: four files, `tier1-ts-{node22,bun}-{private,private-10x}-<stamp>.json`, each with
`"power": "AC Power"`.

- [ ] **Step 2: The RSS probe**

`bench/probes/rss.sh`:

```bash
#!/usr/bin/env bash
# Samples resident memory of the processes whose command line matches a pattern, once a second,
# and writes one JSON result. Usage: rss.sh <pattern> <scenario> <seconds> <out.json>
set -euo pipefail

pattern=$1
scenario=$2
seconds=$3
out=$4

samples=()
for ((i = 0; i < seconds; i++)); do
  # ps reports RSS in KiB; the sum covers every matching process (an app and its helpers).
  kib=$(ps -axo rss=,command= | grep -E -- "$pattern" | grep -v -E 'grep|rss\.sh' | awk '{s += $1} END {print s + 0}')
  samples+=("$((kib * 1024))")
  sleep 1
done

printf '%s\n' "${samples[@]}" | jq -s \
  --arg pattern "$pattern" --arg scenario "$scenario" --arg date "$(date -u +%FT%TZ)" \
  '{schema: 1, tier: 2, metric: "rss", unit: "bytes", pattern: $pattern, scenario: $scenario, date: $date,
    samples: ., stats: {min: min, max: max, p50: (sort | .[(length / 2 | floor)])}}' >"$out"
echo "$scenario: p50 $(jq '.stats.p50 / 1048576 | floor' "$out") MiB -> $out"
```

Run: `chmod +x bench/probes/rss.sh && shellcheck bench/probes/rss.sh`

Expected: no findings.

- [ ] **Step 3: The scripted typist**

`bench/probes/drive-queries.sh`:

```bash
#!/usr/bin/env bash
# Types every non-empty query from fixtures/queries.json into the focused search field until
# <count> queries have been typed, clearing the field between them. The terminal running this
# needs Accessibility permission (System Settings > Privacy & Security > Accessibility).
# Usage: drive-queries.sh <count> [pause-seconds]
set -euo pipefail

count=$1
pause=${2:-0.4}
# macOS ships bash 3.2, which has no mapfile.
texts=()
while IFS= read -r line; do texts+=("$line"); done < <(jq -r '.[] | select(.text != "") | .text' fixtures/queries.json)

for ((i = 0; i < count; i++)); do
  text=${texts[i % ${#texts[@]}]}
  osascript \
    -e 'tell application "System Events"' \
    -e 'keystroke "a" using command down' \
    -e 'key code 51' \
    -e "keystroke \"$text\"" \
    -e 'end tell'
  sleep "$pause"
done
```

Run: `chmod +x bench/probes/drive-queries.sh && shellcheck bench/probes/drive-queries.sh`

Expected: no findings.

- [ ] **Step 4: Identify Raycast's processes**

Open Raycast and run kb's **Search** command. In a terminal run:

```bash
ps -axo pid,ppid,rss,command | grep -i -E 'raycast' | grep -v grep
```

Record in `docs/experiment/methodology.md` (Step 7) two patterns: one matching the Raycast app with all its
helpers (for example `Raycast.app`), and one matching only the Node worker that hosts extensions (the process
whose command line names Raycast's bundled Node or extension host — confirm by closing Raycast: the worker's RSS
drops or the process exits). Use them as `RAYCAST_ALL` and `RAYCAST_WORKER` below.

- [ ] **Step 5: Measure the three scenarios**

Make sure the index is built from the private corpus: in Raycast's kb preferences point **Sources Directory** at
`~/Work/rust/kb/fixtures/private`, run **Rebuild Index**, and wait for it to finish. Then:

```bash
R=docs/experiment/results; S=$(date -u +%Y%m%dT%H%M%SZ)
# 1. Idle: Raycast running, its window closed for at least 60 s.
bench/probes/rss.sh "$RAYCAST_ALL" idle 30 "$R/tier2-ts-rss-all-idle-$S.json"
bench/probes/rss.sh "$RAYCAST_WORKER" idle 30 "$R/tier2-ts-rss-worker-idle-$S.json"
# 2. Open: kb Search open and loaded.
bench/probes/rss.sh "$RAYCAST_ALL" open 30 "$R/tier2-ts-rss-all-open-$S.json"
bench/probes/rss.sh "$RAYCAST_WORKER" open 30 "$R/tier2-ts-rss-worker-open-$S.json"
# 3. After 100 queries: focus kb's search field, then within 3 s start:
sleep 3; bench/probes/drive-queries.sh 100
bench/probes/rss.sh "$RAYCAST_ALL" after-100-queries 30 "$R/tier2-ts-rss-all-after-100-queries-$S.json"
bench/probes/rss.sh "$RAYCAST_WORKER" after-100-queries 30 "$R/tier2-ts-rss-worker-after-100-queries-$S.json"
```

Expected: six result files; each run prints its p50 in MiB. If the worker idle sample is 0, Raycast unloaded the
extension — that is a finding, recorded as such.

Cold-start CPU: quit Raycast (`osascript -e 'quit app "Raycast"'`), wait 5 s, open it, open kb Search, wait until
results show, then record the CPU time every matching process has used since it started:

```bash
for scope in all worker; do
  pattern=$([ "$scope" = all ] && echo "$RAYCAST_ALL" || echo "$RAYCAST_WORKER")
  ps -axo time=,command= | grep -E -- "$pattern" | grep -v grep | awk '{print $1}' |
    jq -R 'split(":") | (.[0] | tonumber) * 60 + (.[1] | tonumber)' | jq -s \
      --arg scope "$scope" --arg date "$(date -u +%FT%TZ)" \
      '{schema: 1, tier: 2, metric: "cold-start-cpu", unit: "seconds", implementation: "ts", scope: $scope,
        date: $date, processes: length, seconds: add}' >"$R/tier2-ts-cpu-$scope-$S.json"
done
```

`ps` prints `TIME` as `minutes:seconds.hundredths`, which the first `jq` turns into seconds.

Point Raycast's **Sources Directory** back at its previous value afterwards.

- [ ] **Step 6: Measure the artifact size**

Run:

```bash
R=docs/experiment/results; S=$(date -u +%Y%m%dT%H%M%SZ)
(cd "$KB_TS_REPO" && bun run --cwd apps/kb build >/dev/null)
dist="$KB_TS_REPO/apps/kb/dist"
jq -n --arg date "$(date -u +%FT%TZ)" --arg commit "$(git -C "$KB_TS_REPO" rev-parse HEAD)" \
  --argjson bytes "$(find "$dist" -type f -exec stat -f %z {} + | awk '{s += $1} END {print s}')" \
  --argjson files "$(find "$dist" -type f | wc -l | tr -d ' ')" \
  --argjson js "$(find "$dist" -type f -name '*.js' -exec stat -f %z {} + | awk '{s += $1} END {print s + 0}')" \
  '{schema: 1, tier: 2, metric: "artifact-size", unit: "bytes", implementation: "ts", date: $date,
    tsRepoCommit: $commit, bytes: $bytes, files: $files, jsBytes: $js}' >"$R/tier2-ts-size-$S.json"
cat "$R/tier2-ts-size-$S.json"
```

`ray build` bundles every runtime dependency into `dist`, so its size is the extension's whole footprint on disk;
Raycast itself is not counted. The build writes only to the Raycast repo's gitignored `dist`.

Expected: one JSON file with `bytes`, `files` and `jsBytes`.

- [ ] **Step 7: Write the methodology**

`docs/experiment/methodology.md`:

```markdown
# Methodology

How every number in the report is produced. A result that was not produced this way is not reported.

## Corpora

| Name          | What                                                     | In git                       |
| ------------- | -------------------------------------------------------- | ---------------------------- |
| `sample`      | hand-written, every notes shape (`fixtures/sample`)      | yes, with its goldens        |
| `private`     | snapshot of the real sources, verified by manifest       | manifest only                |
| `private-10x` | ten copies of `private` in `copy-0` … `copy-9`           | no                           |

Every run verifies `fixtures/private.sha256` first and records the corpus digest in its result.

## Statistics

Every figure is a nearest-rank percentile of measured samples — no interpolation, so every reported time was
actually observed. `bench/ts/stats.ts` and `kb-bench` implement the same definition.

## Tier 1 — engine

| Case                 | Warm-up | Samples | What one sample is                                                                 |
| -------------------- | ------- | ------- | ---------------------------------------------------------------------------------- |
| `scan`               | 3       | 20      | find and parse every source file into entries                                      |
| `markdown`           | 3       | 20      | build the notes Markdown of every entry                                             |
| `sync-cold`          | 2       | 10      | full sync into a database that does not exist                                       |
| `sync-warm`          | 2       | 10      | full sync into an existing database                                                 |
| `search-app/<q>`     | 20      | 200     | the app's path: open read-only, run the rendered SQL, close, map rows to entries   |
| `search-engine/<q>`  | 50      | 500     | the prepared statement on one open connection                                       |

The TS engine runs under Node 22 — what Raycast runs extensions on — and under Bun for reference. The machine is
on AC power with other heavy apps closed; results record the power source.

## Tier 2 — footprint

- RSS, sampled once a second for 30 s by `bench/probes/rss.sh`, in three scenarios: idle with the window closed,
  search open, and after 100 scripted queries (`bench/probes/drive-queries.sh`).
- Raycast is measured two ways: the extension worker alone (`RAYCAST_WORKER`) and the whole app with its helpers
  (`RAYCAST_ALL`), because the native app replaces both for this use.
- Process patterns used on this machine: `RAYCAST_ALL=<pattern recorded in Task 14 Step 4>`,
  `RAYCAST_WORKER=<pattern recorded in Task 14 Step 4>`.
- Artifact size: the `ray build` output, which bundles every runtime dependency.
- Cold-start CPU: the CPU time the processes have used from a fresh launch until search results first show.

## Tier 3 — perceived latency

Written in Plan 4, when both apps exist and one harness can drive them both.

## Results

One JSON file per run in `docs/experiment/results/`, named `tier<N>-<implementation>-<…>-<UTC stamp>.json`. Tier 1
files carry every sample.
```

Replace both `<pattern recorded …>` markers with the patterns found in Step 4 before committing.

- [ ] **Step 8: Commit the baseline**

```bash
git add bench/probes docs/experiment/methodology.md docs/experiment/results
git commit -m "test: Record the Raycast baseline at tiers 1 and 2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Results hold timings, sizes, query texts and corpus digests only — no corpus content. Confirm before committing:
`grep -l notes_markdown docs/experiment/results/* || echo clean` prints `clean`.

---

### Task 15: The UI/UX parity matrix

**Files:**
- Create: `docs/experiment/parity.md`

Written now, from the Raycast code, before any UI exists — so the port is measured against what Raycast does,
not against what the port happened to build. Plan 3 fills in **Status** and **Evidence**.

- [ ] **Step 1: Write the matrix**

`docs/experiment/parity.md`:

```markdown
# UI/UX parity

One row per user-visible behaviour of kb's Raycast search command. Sources are paths in the Raycast repo
(`apps/kb/src/`). **Status** is Same, Adapted, Better or Missing; anything but Same carries a justification.
Plan 3 fills in Status and Evidence (a `TestAppContext` test, a screenshot pair, or both).

## Surfaces

| #   | Behaviour in Raycast                                                                                                       | Source                              | Status | Evidence | Justification |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------ | -------- | ------------- |
| S01 | Search field with placeholder "Search knowledge base..."; typing searches after 150 ms                                      | `search.screen.tsx`, `use-search.ts` |        |          |               |
| S02 | Results ordered by FTS rank; by title when the query is empty                                                              | `search.ts` (domain)                |        |          |               |
| S03 | Pages of 50; the next page loads at the end of the list                                                                    | `pagination.ts`                     |        |          |               |
| S04 | Previous results stay on screen while the next query runs; a loading indicator shows                                       | `use-search.ts`                     |        |          |               |
| S05 | Row icon: type icon tinted by type colour; bookmarks show the site favicon, globe fallback; tooltip names the type         | `icons.ts`, `accessories.ts`        |        |          |               |
| S06 | Row title, and the description as subtitle                                                                                 | `search.screen.tsx`                 |        |          |               |
| S07 | Row accessories: up to 3 tags (`#tag`, colour hashed from the tag, or the tag's icon from assets), `+N` for the rest, link count with a link icon | `accessories.ts`, `assets.ts` |        |          |               |
| S08 | Empty states: Loading…; No entries indexed yet (with Rebuild); No matching entries                                         | `empty.tsx`                         |        |          |               |
| S09 | Split pane toggled with → and ←: the notes Markdown, or "*No additional notes available for this entry.*", above the metadata | `detail.tsx`, `actions.tsx`      |        |          |               |
| S10 | Metadata, in order: URL link (bookmarks) or Command (commands); Type tag; Status; Priority; Description; Tags; Links; Source | `metadata.tsx`                     |        |          |               |
| S11 | Detail screen pushed with Return: the entry title as navigation title, the notes, metadata toggled with → and ←           | `detail.tsx`                        |        |          |               |
| S12 | Notes rendering: headings, lists, tables, blockquote description, highlighted code blocks, YouTube thumbnail, SVG and image blocks, mermaid diagram, LINKS list, source footer | `markdown.ts` (domain) |   |          |               |

## Filter

| #   | Behaviour in Raycast                                                                                                  | Source       | Status | Evidence | Justification |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------ | ------ | -------- | ------------- |
| F01 | A dropdown beside the search field: a summary item and Clear All Filters; a Types section; a Tags section            | `filter.tsx` |        |          |               |
| F02 | Choosing a type or tag toggles it; several can be active; any selected type and every selected tag must match        | `filter.tsx`, `search.ts` |  |    |               |
| F03 | Filters reset on every launch                                                                                         | `filter.tsx` |        |          |               |

## Actions

| #   | Behaviour in Raycast                                                                                                                     | Source        | Status | Evidence | Justification |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------ | -------- | ------------- |
| A01 | ⌘K opens the action panel; actions are grouped in sections with their shortcuts shown                                                    | `actions.tsx` |        |          |               |
| A02 | List: Return shows details (push)                                                                                                        | `actions.tsx` |        |          |               |
| A03 | List: ⌘Return runs the type's primary action — Open in Browser (bookmarks); Copy Command Snippet; Copy Cheat Sheet; Copy Notes; Copy Task; Copy Primary Content | `actions.tsx` | | |   |
| A04 | Detail: Return runs the type's primary action                                                                                            | `actions.tsx` |        |          |               |
| A05 | ⌘C copies a bookmark's URL                                                                                                               | `actions.tsx` |        |          |               |
| A06 | → / ← show and hide Details (list) or Metadata (detail)                                                                                  | `actions.tsx` |        |          |               |
| A07 | ⌘O opens the source file                                                                                                                 | `actions.tsx` |        |          |               |
| A08 | Links submenu: per link, Open and Copy URL                                                                                               | `actions.tsx` |        |          |               |
| A09 | Copy… submenu: Title, Description, Notes, Raw YAML (Description and Notes only when present)                                            | `actions.tsx` |        |          |               |
| A10 | ⌘R Rebuild Index…; ⌘⇧, Open Extension Preferences                                                                                       | `actions.tsx` |        |          |               |

## Sync

| #   | Behaviour in Raycast                                                                                                  | Source                         | Status | Evidence | Justification |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------ | -------- | ------------- |
| Y01 | Rebuild screen with progress: files scanned of total, entries, current file; can be stopped                          | `sync/screen.tsx`, `sync/progress.ts` |  |      |               |
| Y02 | A toast on completion; on failure, a toast with Open Extension Preferences                                            | `sync/use-sync.ts`             |        |          |               |
| Y03 | Report: files in sections by status; a file's detail shows an excerpt and File, Status, Location, Entries, Types       | `sync/report.ts`, `sync/file.tsx` |     |          |               |
| Y04 | Stopped and Failed states, with Retry and Open Extension Preferences                                                  | `sync/screen.tsx`              |        |          |               |

## Launch and preferences

| #   | Behaviour in Raycast                                                                     | Source         | Status | Evidence | Justification |
| --- | ---------------------------------------------------------------------------------------- | -------------- | ------ | -------- | ------------- |
| L01 | Opened from Raycast's root search or a user-assigned hotkey; Esc pops, then closes      | Raycast        |        |          |               |
| P01 | The Sources Directory preference, defaulting to `~/.config/kodexb/sources`              | `paths.ts`     |        |          |               |

## Tasks

The five tasks measured for task cost (keystrokes and tier 3 time) in Plan 4, on both apps.

| #   | Task                                                    |
| --- | ------------------------------------------------------- |
| T1  | Find a bookmark by a word in its title and open it      |
| T2  | Find a command and copy it                              |
| T3  | Filter by one type and one tag                          |
| T4  | Read a code-heavy note in the detail screen             |
| T5  | Rebuild the index                                       |
```

- [ ] **Step 2: Check it against the code**

For each file named in the Source column, open it in `$KB_TS_REPO/apps/kb/src/` and confirm every user-visible
string, shortcut and state it renders is covered by a row. Add a row for anything missing, numbered after the last
row of its section.

- [ ] **Step 3: Verify formatting and commit**

```bash
dprint fmt docs/experiment/parity.md && typos docs/experiment/parity.md
git add docs/experiment/parity.md
git commit -m "docs(experiment): Add the UI/UX parity matrix

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Close out Plan 1

- [ ] **Step 1: Run every gate**

Run: `mise run gate && hk check --all --profile candidate`

Expected: every step passes. `coverage` reports no tests (kb-domain is empty until Plan 2).

- [ ] **Step 2: Confirm nothing private is tracked**

Run: `git ls-files | grep -E '^fixtures/private(/|-)' ; git ls-files fixtures | sort`

Expected: the first command prints nothing; the second lists `fixtures/private.sha256`, `fixtures/queries.json`,
`fixtures/sample/**` and `fixtures/sample-goldens/**` only.

- [ ] **Step 3: Summarize the baseline**

Run:

```bash
for f in docs/experiment/results/tier1-ts-node22-private-2*.json; do
  jq -r '"\(.corpus.name) \(.env.runtime): " + ([.cases[] | select(.name | test("^(scan|markdown|sync-cold|sync-warm)$")) | "\(.name) p50 \(.stats.p50 / 1e6 | . * 10 | floor / 10) ms"] | join(", "))' "$f"
  jq -r '[.cases[] | select(.name | startswith("search-app/")) | .stats.p95] | sort | "search-app p95 median across queries: \(.[(length / 2 | floor)] / 1e6) ms"' "$f"
done
```

Expected: one line of engine timings and one search line for the private corpus. Report these numbers to the
owner; they are the baseline Plans 2–4 are measured against.
```
