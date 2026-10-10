# kb native port — Plan 5 completion: measurement and report — design

- Status: approved
- Date: 2026-10-10
- Replaces: the "Remaining work" of `docs/superpowers/plans/2026-10-09-kb-native-05-mvp-compliance-and-report.md`

> **Paths moved (2026-10-10).** Written before the repository layout
> ([design](2026-10-10-repository-layout-design.md)): `bench/` is now `tools/bench/`, `fixtures/` is split between
> `crates/kb-domain/tests/fixtures/` and `tools/bench/fixtures/`, and `xtask` is `kb-report`.

## Goal

Finish the experiment: every figure the report needs comes from a mise task, the runs happen in one ordered session,
and the report, a hand-written findings note and a README summary close it.

Half 1 of Plan 5 (MVP compliance and packaging) is done and verified at `06190c7`; this design covers what the
review of that plan found missing.

## Problems this design fixes

| #  | Problem                                                                                                      | Fixed by     |
| -- | ------------------------------------------------------------------------------------------------------------ | ------------ |
| 1  | Cold-start CPU scripts are wired to no task                                                                  | D1           |
| 2  | Size has no task for Raycast, and no fresh run is planned                                                    | D1           |
| 3  | `latency.sh raycast` defaults to ⌘Space, Raycast's root search, not the kb command                           | D3           |
| 4  | The old checklist passes `--verified` by hand and skips `dprint fmt`                                         | D7           |
| 5  | Uncommitted results make the report cite a `-dirty` commit                                                   | D7           |
| 6  | Nothing prepares the isolated kb home (`KB_HOME`) or syncs its index                                         | D2           |
| 7  | Session preconditions are undocumented                                                                       | D7           |
| 8  | Raycast's manual keystroke timing has nowhere to go                                                          | D4           |
| 9  | A remediation note cannot live in the generated report                                                       | D6           |
| 10 | The spec's report asks for charts, dependency depth, coverage, clippy/jscpd/complexity vs fallow; none exist | D5           |
| 11 | The plan is not in the format of Plans 1–4                                                                   | the new plan |

## Decisions

**D1. One task per measurement.** `bench:cpu <kb|raycast>` runs `cpu-rs.sh` or `cpu-ts.sh`; `bench:size <kb|raycast>`
runs `size-rs.sh` (through the existing `size` task) or `size-ts.sh`. Result names are unchanged.

**D2. An isolated, synced kb home.** `kb --sync` rebuilds the index from the configured sources with
`kb_domain::sync::sync_knowledge_base`, prints one line per failed file and a summary to stderr, and exits non-zero
when the sync itself fails (a failed file is reported, not fatal: Raycast skips it the same way); it never opens a
window. `mise run bench:home` runs `mise run fixtures`, writes
`tmp/bench-home/.config/kb/config.toml` with `sources_path` set to the absolute `fixtures/private`, and runs
`HOME=tmp/bench-home target/release/kb --sync`. `dirs` reads `HOME`, so the index lands in
`tmp/bench-home/Library/Application Support/…`. Every kb probe defaults `KB_HOME` to `tmp/bench-home` and fails when its
index is missing.

**D3. Raycast's hotkey is configuration.** The owner assigns kb Search a hotkey in Raycast and records it as
`KB_RAYCAST_HOTKEY="<keycode> <mods>"` in `mise.local.toml` (gitignored). `latency.sh raycast` fails with a pointer to
methodology when it is unset; the ⌘Space default goes.

**D4. The manual figure is a result.** `bench/probes/manual-keystroke.sh <fps> <frames>...` turns frame counts into
`tier3-raycast-keystroke-manual-<stamp>.json` (shared schema: `samples` and nearest-rank `stats` in ms,
`method: "manual-<fps>fps"`). `xtask` shows it in the Raycast cell of "Keystroke → updated list" instead of
"manual (methodology)". It does not enter the performance criterion, which stays search p95 or ⌘↩.

**D5. The cheap maintainability measures; charts and fallow dropped.** `maint.sh` adds, per implementation:

- `deps.depth`: Rust, the maximum `cargo tree -p kb-app -e normal --prefix depth` depth; TypeScript, the maximum depth of
  `npm ls --all --json` under `$KB_TS_REPO/apps/kb` (read only), or `null` with a note if npm cannot read Bun's tree.
- `coverage.lines`: Rust, line percent of `kb-domain` and `kb-app` from `cargo llvm-cov --json --summary-only`;
  TypeScript `null` — the Raycast repo has no Vitest coverage provider, and installing one would write to it.
- `duplication.percent`: jscpd over the same paths as the line counts, output under `tmp/`, read only on both sides.
- `lint.clippyWarnings`: Rust only, the count from `cargo clippy --message-format json` (0 while the gate holds).

`xtask` renders each as a row in "Maintainability". The experiment spec's Report section gets a dated amendment: charts
and the fallow health comparison are dropped — tables carry the same numbers, and fallow has no Rust counterpart to
compare with.

**D6. Findings outside the generated report.** `docs/experiment/findings.md` is hand-written after the report: for every
criterion that failed or was not measured, why and what would fix it, plus the notable observations. `xtask` adds a
link to it under the Verdict when the file exists. The README gets a `## Findings` section — the verdict, the headline
figures (search p95 ratio, ⌘↩, RSS share, binary vs bundle size) and links to `report.md` and `findings.md`.

**D7. One ordered session.** `mise run bench:session` runs, in order: `bench:home`, `package`, `probes`, `bench:size`
both, `bench:maint`, `bench:memory` both, `bench:cpu` both, `bench:e2e` both. It first checks the preconditions it can
(probe built, `KB_RAYCAST_HOTKEY` set, Raycast running, the kb extension present under
`~/.config/raycast/extensions/kb`, on AC power) and stops with what is missing. The owner then records the manual
keystroke figure (D4), commits the results, and runs `mise run report` — never `xtask report --verified` directly.
Accessibility permission and `ray develop` are owner steps listed in methodology. Tier 1 is not re-run: `06190c7`
changed only comments and doctests in `kb-domain`.

## Testing

- `kb --sync`: argument parsing unit-tested; an integration test runs the built binary with `HOME` set to a temp dir
  whose config points at `fixtures/sample` and asserts exit 0 and an index file; one with a missing sources directory
  asserts a non-zero exit and a message.
- `xtask`: unit tests for the manual keystroke cell, each new maintainability row (present and `null`), and the
  findings link (present only when the file exists).
- Scripts: shellcheck and shfmt through hk; `manual-keystroke.sh` checked by running it into a temp dir and reading
  the JSON with `jq`.
- `mise run gate` passes after every task.

## Scope

In: D1–D7, the experiment spec's amendment, and a replacement Plan 5 in the format of Plans 1–4.

Out: tier 1 re-runs, TypeScript coverage, charts, fallow, distribution signing, and any change to the Raycast repository.
