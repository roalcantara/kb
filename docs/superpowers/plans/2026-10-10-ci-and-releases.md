# CI and releases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking. The workflow itself is the test: a pushed branch runs `lint` and
> `test`; `main` runs `plan`.

**Goal:** GitHub Actions checks every push, and semantic-release turns releasable pushes to `main` into GitHub
Releases with `CHANGELOG.md` and the packaged `kb.app`.

**Architecture:** One workflow whose jobs call mise tasks; semantic-release configured in `.releaserc.yml` and run
through `npx` from a mise task; macOS only for a release.

**Tech Stack:** GitHub Actions, mise (`jdx/mise-action`), hk, semantic-release 25 with official plugins, cargo-packager.

**Spec:** [docs/superpowers/specs/2026-10-10-ci-and-releases-design.md](../specs/2026-10-10-ci-and-releases-design.md)

---

## File map

| Path                                                | What                                                                    | Task |
| --------------------------------------------------- | ----------------------------------------------------------------------- | ---- |
| `mise.toml`                                         | `ci`, `ci:lint`, `ci:test`, `release`, `release:version`, `release:app` | 1, 2 |
| `.releaserc.yml`, `CHANGELOG.md`                    | semantic-release config, seed changelog                                 | 2    |
| `.github/workflows/ci.yml`                          | the five jobs                                                           | 3    |
| `README.md`, `docs/adr/0007-releases.md`, `TODO.md` | docs and follow-ups                                                     | 4    |

### Task 1: CI tasks

- [ ] Add `ci`, `ci:lint`, `ci:test` to `mise.toml`.
- [ ] Run `mise run ci:lint` and `mise run ci:test` locally. Expected: both pass. Commit.

### Task 2: Release tasks and config

- [ ] Add `release`, `release:version`, `release:app`; write `.releaserc.yml` and `CHANGELOG.md`.
- [ ] Check `mise run release:version 9.9.9` changes only the workspace version (then restore); `mise run release:app`
      writes `dist/kb-<version>-macos-arm64.zip` that unzips to a signed `kb.app`; `.gitignore` covers `dist/`.
- [ ] Commit.

### Task 3: Workflow

- [ ] Write `.github/workflows/ci.yml`; `pinact run` pins the actions; `actionlint` and `zizmor` pass.
- [ ] Commit; push the branch. Expected: `lint` and `test` pass on GitHub; `plan`, `app`, `release` skipped.

### Task 4: Docs, seed tag, merge

- [ ] README "Releases"; ADR 0007; `TODO.md` (done task; Pages, Linux build, notarization, universal binary).
- [ ] Tag `v0.1.0` on `main`'s current head and push it; merge the branch into `main`; push. Expected: `plan` reports
      no release (only non-releasing commit types since the tag); `app` and `release` skipped.
- [ ] Local `mise run release -- --dry-run --no-ci` lists the commits analysed since `v0.1.0`.
