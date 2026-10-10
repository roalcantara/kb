# Repository layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking. Moves are mechanical; the full gate is the test.

**Goal:** Three root folders (`crates/`, `docs/`, `tools/`), with the benchmark kit isolated in `tools/bench/` so it can
be deleted without breaking the product, its tests or the gate.

**Architecture:** `git mv` the folders, then repoint every path: Cargo workspace, mise tasks (the kit's in an included
`tools/bench/tasks.toml`), hk, linters' configs, tests, scripts and live docs. Earlier plans and specs are not edited.

**Tech Stack:** git, Cargo workspace, mise `task_config.includes`, hk, ls-lint, dprint, typos, jscpd, gitleaks, taplo.

**Spec:** [docs/superpowers/specs/2026-10-10-repository-layout-design.md](../specs/2026-10-10-repository-layout-design.md)

---

## File map

| From                                           | To                                                         | Task |
| ---------------------------------------------- | ---------------------------------------------------------- | ---- |
| `fixtures/sample`, `fixtures/sample-goldens`   | `crates/kb-domain/tests/fixtures/`                         | 1    |
| `vendor/`                                      | `crates/third-party/`                                      | 2    |
| `tools/size-budget`, `bench/probes/size-rs.sh` | `tools/size/budget`, `tools/size/size.sh`                  | 3    |
| `bench/ts`, `bench/probes`                     | `tools/bench/ts`, `tools/bench/probes`                     | 4    |
| `crates/kb-bench`, `crates/xtask`              | `tools/bench/kb-bench`, `tools/bench/report` (`kb-report`) | 4    |
| `fixtures/queries.json`, `fixtures/private*`   | `tools/bench/fixtures/` (+ links to the sample)            | 4    |
| bench tasks in `mise.toml`                     | `tools/bench/tasks.toml`                                   | 4    |

### Task 1: The product's fixtures move to kb-domain

- [ ] `git mv fixtures/sample fixtures/sample-goldens crates/kb-domain/tests/fixtures/`
- [ ] Repoint `crates/kb-domain/tests/goldens.rs` defaults, `crates/kb-app/tests/ui.rs` and `tests/sync_cli.rs`.
- [ ] Run `mise run gate --fast`. Expected: every test passes. Commit.

### Task 2: Patched crates move to `crates/third-party/`

- [ ] `git mv vendor crates/third-party`; repoint `Cargo.toml` (`exclude`, `[patch.crates-io]`), hk and dprint excludes,
      `TODO.md`.
- [ ] Run `cargo build --locked -p kb-app` (no lockfile change) and `hk check --all`. Commit.

### Task 3: The size budget becomes product tooling

- [ ] `git mv tools/size-budget tools/size/budget`; `git mv bench/probes/size-rs.sh tools/size/size.sh`; repoint the
      script, hk's size step and the root `size` task (budget check only).
- [ ] Run `mise run size`. Expected: `kb: <n> MiB …, budget 29 MiB`. Commit.

### Task 4: The benchmark kit moves to `tools/bench/`

- [ ] `git mv bench/ts bench/probes tools/bench/`; `git mv crates/kb-bench tools/bench/kb-bench`;
      `git mv crates/xtask tools/bench/report` and rename the package `kb-report` (its root becomes `../../..`);
      `git mv fixtures/queries.json fixtures/private.sha256 tools/bench/fixtures/`; move the local `fixtures/private*`;
      link `tools/bench/fixtures/{sample,sample-goldens}` to the kb-domain fixtures.
- [ ] Move the kit's tasks (`bench:*`, `fixtures`, `goldens`, `parity`, `probes`, `report`, new `bench:setup`) to
      `tools/bench/tasks.toml`, included from `mise.toml` in a marked block with the kit-only `[env]`.
- [ ] Repoint every path: `Cargo.toml` members, scripts, `.gitignore`, `.gitleaks.toml`, `.jscpd.json`, `.ls-lint.yml`,
      `taplo.toml`, `_typos.toml`, `dprint.json`, hk (one marked block for the TS bench steps).
- [ ] Write `tools/bench/README.md`: what the kit is, how to run it, the purge steps.
- [ ] Run `mise tasks` (every kit task listed), `mise run bench:home`, `mise run gate`. Commit.

### Task 5: Root hygiene, docs, TODO

- [ ] `.gitignore`: one block for local state (`graphify-out/`, `.code-review-graph/`, `.delta/`).
- [ ] hk step `root-layout`: tracked top-level folders are only `crates`, `docs`, `tools` (and `.github`).
- [ ] README "Project Structure" documents the layout; AGENTS.md's map points to it; CONTEXT, methodology, compliance,
      ADRs, Plan 5 and its design take the new paths.
- [ ] `TODO.md`: new paths in positions; tasks for the `.config/` evaluation and the kit purge option.
- [ ] Run `mise run gate`. Commit.

### Task 6: Merge and publish

- [ ] Merge `feat/plan5-measurement-session` into `main`.
- [ ] Check `gh repo view roalcantara/kb`; if absent, `gh repo create roalcantara/kb --private`; add it as `origin`;
      push `main`.
