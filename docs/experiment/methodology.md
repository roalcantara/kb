# Methodology

How every number in the report is produced. A result that was not produced this way is not reported.

## Corpora

| Name          | What                                                | In git                |
| ------------- | --------------------------------------------------- | --------------------- |
| `sample`      | hand-written, every notes shape (`fixtures/sample`) | yes, with its goldens |
| `private`     | snapshot of the real sources, verified by manifest  | manifest only         |
| `private-10x` | ten copies of `private` in `copy-0` … `copy-9`      | no                    |

Every run verifies `fixtures/private.sha256` first and records the corpus digest in its result.

## Statistics

Every figure is a nearest-rank percentile of measured samples — no interpolation, so every reported time was
actually observed. `bench/ts/stats.ts` and `kb-bench` implement the same definition.

## Tier 1 — engine

| Case                | Warm-up | Samples | What one sample is                                                                     |
| ------------------- | ------- | ------- | -------------------------------------------------------------------------------------- |
| `scan`              | 3       | 20      | find and parse every source file into entries                                          |
| `markdown`          | 3       | 20      | build the notes Markdown of every entry                                                |
| `sync-cold`         | 2       | 10      | full sync into a database that does not exist                                          |
| `sync-warm`         | 2       | 10      | full sync into an existing database                                                    |
| `search-app/<q>`    | 20      | 200     | each app's real path, rows mapped back to entries (see below: TS reconnects per query) |
| `search-engine/<q>` | 50      | 500     | the prepared statement on one open connection                                          |

The TS engine runs under Node 22 — what Raycast runs extensions on — and under Bun for reference. The machine is
on AC power with other heavy apps closed; results record the power source.

The Rust engine runs the same cases (`kb-bench`, release build). `search-app` is each app's real path:
TypeScript opens a read-only connection per query, as `@raycast/utils`' `executeSQL` does; Rust reuses the
connection its app keeps open. Both turn every row back into an entry, re-reading its YAML.

## Tier 2 — footprint

- RSS, sampled once a second for 30 s by `bench/probes/rss.sh`, in three scenarios: idle with the window closed,
  search open, and after 100 scripted queries (`bench/probes/drive-queries.sh`).
- Raycast is measured two ways: the extension worker alone (`RAYCAST_WORKER`) and the whole app with its helpers
  (`RAYCAST_ALL`), because the native app replaces both for this use.
- Process patterns used on this machine: `RAYCAST_ALL=(Raycast\.app|Raycast Backend|com\.raycast)`,
  `RAYCAST_WORKER=Raycast Backend`.
- Caveats on the Raycast figures: `Raycast Backend` is the Node host shared by every extension, so the
  worker figure is an upper bound on kb's share; and kb runs under `ray develop`, i.e. the unminified dev bundle.
- Artifact size: `bench/probes/size-ts.sh` measures the bundle Raycast loads, `~/.config/raycast/extensions/kb`,
  which `ray build` and `ray develop` write by default. (`ray build -e dist` fails here: its type-definition step
  needs the TypeScript JS API, which TypeScript 7 does not ship.) The bundle holds all five commands;
  `searchCommandJsBytes` is kb search alone.
- Physical footprint, sampled the same way by `bench/probes/footprint.sh` from macOS's `footprint`: what Activity
  Monitor shows as Memory. It counts the GPU memory a window holds, which RSS leaves out, so it is reported beside RSS
  for a GPU-drawn app; RSS stays the spec's criterion.
- kb runs as the packaged `.app` (`mise run package`) over `fixtures/private`, through a home whose
  `~/.config/kb/config.toml` points there: `mise run bench:home` builds it in `tmp/bench-home` and syncs its index with
  `kb --sync`. Every kb probe uses it unless `KB_HOME` names another. Its pattern is `kb\.app/Contents/MacOS/kb`.
- Cold-start CPU: `bench/probes/cpu-ts.sh` and `bench/probes/cpu-rs.sh`, five runs each. Each run stops Raycast (`killall`: it refuses
  AppleScript's quit), relaunches it, opens kb Search by deeplink, waits 10 s for both processes to go idle, and
  sums the CPU time (`ps` TIME) the matching processes have used since launch.

## Tier 3 — perceived latency

One driver for both apps: `bench/probes/probe.swift` (`mise run probes` builds `tmp/bin/probe`) posts key events with
CGEvent at the HID level, the way a keyboard does, and watches for the result from outside the app. AppleScript's
`keystroke` is not used: it hands focus back to the calling app, which hides a launcher. The terminal needs
Accessibility permission; nothing needs Screen Recording.

- **Warm-up.** The first event a process posts reaches the app 25–90 ms late, and later ones in 2–4 ms (measured
  against a bare AppKit window). Every timed press is therefore preceded by an unbound key-up (F19) and 100 ms.
  Before this was found, every external figure carried that offset.
- **Clock.** It starts when key-down is posted, which is what apps act on; key-up follows 10 ms later while the polling
  (every 1 ms) goes on.
- **Show** (`bench/probes/latency.sh`): hotkey → the app's window on screen, from `CGWindowListCopyWindowInfo`; 30
  rounds of show, type a query, clear it, hide. A re-shown window appears with its last frame, so this is when the
  user sees the panel, not when it has redrawn.
- **Action** (`bench/probes/action.sh`): task T2's step, ⌘↩ → the clipboard's change count moving; 30 rounds, after a
  query has settled. kb opens by its hotkey, Raycast's kb command by its deeplink; how it opens does not change the
  step.
- **Inside kb** (`kb --trace`, `src/trace.rs`): hotkey handled → new frame, and keystroke → updated list, both as a
  range: from the start of the frame that draws the change to the start of the next, by which it has been presented.
  The keystroke figure includes the 150 ms debounce; `settle` is from the debounce firing to the frame.
- **Raycast keystroke → updated list** has no signal the probe reads and no trace. It is measured by hand: record the
  screen at 120 fps while typing the last letter of a query, and count frames from the key's echo in the field to the
  list's change, for ten runs at least. `bench/probes/manual-keystroke.sh docs/experiment/results 120 <frames>...`
  records them as `tier3-raycast-keystroke-manual-<stamp>.json`, which the report reads.
- **Raycast's hotkey.** The latency run opens the kb command by its own hotkey, not Raycast's root search: assign kb
  Search a hotkey in Raycast and set it in the gitignored `mise.local.toml` as
  `[env] KB_RAYCAST_HOTKEY = "<keycode> <mods>"` — a macOS virtual keycode (K = 40, Space = 49) and modifiers joined
  by `+`, e.g. `"40 opt+shift"`. The run fails without it.

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

## Baseline history

- 2026-10-08: first tier 1 run, on the Raycast repo at `3de16d2`. Type-filtered searches took 58 ms on `private`
  and 4 s on `private-10x`: SQLite 3.51 (Node 22) drove them from `idx_entries_type`.
- 2026-10-09: kb fixed on branch `fix/kb-search-plan-order` (`8aa510c`, `CROSS JOIN`); tier 1 re-run. Every
  other case is unchanged within 2 %, and the goldens are identical.
- 2026-10-09: the sources were normalized to the spec's source schema (D9): 44 entries render differently, none
  added or lost. The private corpus was re-snapshotted (68 files: `tv.yml` held only an empty key) and tier 1
  re-run. **Plans 2–4 compare against these results** (`tier1-ts-*-20261009T08*`).

## Results

One JSON file per run in `docs/experiment/results/`, named `tier<N>-<implementation>-<…>-<UTC stamp>.json`. Tier 1
files carry every sample.
