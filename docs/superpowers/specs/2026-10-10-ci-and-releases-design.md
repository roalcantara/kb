# CI and releases — design

- Status: approved
- Date: 2026-10-10

## Goal

Every push is checked on GitHub Actions, and every releasable push to `main` becomes a GitHub Release — version,
`CHANGELOG.md`, tag and the packaged `kb.app` — derived by semantic-release from the commit messages. CI and a terminal
run the same mise tasks.

## Constraints

- `roalcantara/kb` is private on GitHub Free: 2,000 Actions minutes a month, macOS minutes count ten times, and Pages
  is unavailable. macOS runs only when a release is due; Pages waits (`TODO.md`).
- hk already runs the full gate locally on commit and push; CI is the shared safety net, not the only one.
- The kb app compiles only on macOS (GPUI); `kb-domain` compiles anywhere.
- Commit messages follow this repo's rules (`.quick-commitlint.json`): types `feat fix chore docs style ref perf test
  build ci`, sentence-case subjects.

## Decisions

**D1. One workflow, five jobs** (`.github/workflows/ci.yml`):

| Job       | Runner   | When                        | Runs                                                                   |
| --------- | -------- | --------------------------- | ---------------------------------------------------------------------- |
| `lint`    | ubuntu   | every push and pull request | `mise run ci:lint`                                                     |
| `test`    | ubuntu   | every push and pull request | `mise run ci:test`                                                     |
| `plan`    | ubuntu   | push to `main`, after both  | `mise run release -- --dry-run`: the next version, or none             |
| `app`     | macos-15 | when `plan` found a version | `mise run gate --fast`, then `mise run release:app <version>`: the zip |
| `release` | ubuntu   | after `app`                 | `mise run release`: changelog, bump commit, tag, release with the zip  |

A release is created only after the macOS checks pass and the app is built, so no tag exists without its app.
semantic-release guarantees the same natively when the build runs in its `prepare` step (it tags after `prepare`,
before `publish`), but only on the runner that builds: running it on macOS for every push to `main` costs macOS minutes
even when nothing is released. `plan` is that check on Linux, with semantic-release's own `--dry-run`. Considered:
release-it-style drafts as in `roalcantara/flux` (`draftRelease: true` on Linux, a `workflow_run` publish on macOS that
un-drafts): it allows a tag before its app and needs an un-draft step.
Concurrency cancels superseded runs except on `main`. Permissions are read-only except where a job writes.

**D2. mise tasks are the interface.** Workflows call only these; each runs the same locally.

| Task                        | Does                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ci`                        | On macOS `gate`; elsewhere `ci:lint` and `ci:test` (in parallel)                                     |
| `ci:lint`                   | `hk check --all`, skipping steps that compile GPUI, need the Raycast link, or read a branch name     |
| `ci:test`                   | kb-domain: clippy, tests, doctests; `cargo deny check`                                               |
| `release`                   | semantic-release through `npx`, plugin versions pinned in the task                                   |
| `release:version <version>` | the workspace version in `Cargo.toml` and `Cargo.lock`, so `kb.app` reports it                       |
| `release:app <version>`     | `release:version`, `package`, then `dist/kb-<version>-macos-arm64.zip` (`ditto` keeps the signature) |

Tools come from `mise.toml` through `jdx/mise-action` (cached), Rust builds through `Swatinem/rust-cache`.

**D3. semantic-release, as in `roalcantara/dots`** (`.releaserc.yml`): commit-analyzer and release-notes-generator
with the `conventionalcommits` preset (`feat` minor; `fix`, `perf` patch; other types release nothing; notes list
Features, Bug Fixes, Performance); changelog (`CHANGELOG.md`); exec (`verifyReleaseCmd` reports the next version to
the workflow; `prepareCmd` runs `release:version`); git (commits `CHANGELOG.md`, `Cargo.toml`, `Cargo.lock` as
`chore(release): <version> [skip ci]`); github (the release, with the zip and a note on opening an ad-hoc-signed app).
`branches: [main]`.

**D4. Versions start at 0.1.0.** `v0.1.0` is tagged once on the current `main`; `feat` then gives 0.2.0, `fix` 0.1.1.

**D5. Buy, not build.** semantic-release and its official plugins, `jdx/mise-action`, `Swatinem/rust-cache`,
`actions/*`. Considered: release-please (versions Cargo natively, but releases through a PR, and semantic-release was
asked for); semantic-release-cargo (crates.io-oriented, workspace support unconfirmed; a one-line version task
suffices); cycjimmy/semantic-release-action (would duplicate the plugin pins `mise run release` holds). Actions are
pinned to commit SHAs by `pinact`, and `actionlint` and `zizmor` check the workflow.

## Scope

In: D1–D5, a seed `CHANGELOG.md`, the `v0.1.0` tag, a README "Releases" section, ADR 0007, `TODO.md`.

Out (`TODO.md`): GitHub Pages, a Linux build of kb, Developer ID signing and notarization, a universal binary.
