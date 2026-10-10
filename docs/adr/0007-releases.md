# 0007. Released by semantic-release from GitHub Actions

- Status: accepted
- Date: 2026-10-10

## Context

Versions, the changelog and the downloadable app were made by hand, if at all. Commit messages already follow
Conventional Commits (`.quick-commitlint.json`), which is all a release tool needs to derive a version. The repository
is private on GitHub Free: 2,000 Actions minutes a month, macOS minutes count ten times, and Pages is unavailable. kb
compiles only on macOS; its engine compiles anywhere.

## Decision

semantic-release (`.releaserc.yml`) derives each release from the commits since the last tag: `feat` a minor version,
`fix` and `perf` a patch, other types none. It writes `CHANGELOG.md`, sets the workspace version in `Cargo.toml` (so
`kb.app` reports it), commits both, tags `vX.Y.Z` and creates the GitHub Release with the zipped `kb.app`. Versions
started at `v0.1.0`.

One workflow, `.github/workflows/ci.yml`, runs it, calling only mise tasks:

- every pull request and push to `main`: `ci:lint` and `ci:test` on Linux;
- a push to `main`: `plan` runs semantic-release with `--dry-run` on Linux; only when it finds a version does `app`
  check and build the app on macOS, and then `release` runs semantic-release with the zip.

semantic-release tags after its `prepare` step, so building the app there would also keep a tag from existing without
its app, but only by running semantic-release on macOS for every push to `main`. The Linux dry run spends macOS minutes
only on a release. Drafts published by a second workflow (as in `roalcantara/flux`) were the other option: a tag can
precede its app, and a draft must be un-drafted.

## Consequences

- A commit's type decides whether it ships: `feat`, `fix` and `perf` release; `ref`, `docs`, `chore` and the rest
  do not.
- The app is signed ad hoc: macOS asks before the first launch. A Developer ID and notarization would remove that.
- `mise run release -- --dry-run --no-ci` previews the next release locally (`GITHUB_TOKEN=$(gh auth token)`).
- GitHub Pages waits until the repository is public or the plan allows it.
