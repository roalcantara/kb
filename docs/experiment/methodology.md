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
- Cold-start CPU: `bench/probes/cpu-ts.sh`, five runs. Each run stops Raycast (`killall`: it refuses
  AppleScript's quit), relaunches it, opens kb Search by deeplink, waits 10 s for both processes to go idle, and
  sums the CPU time (`ps` TIME) the matching processes have used since launch.

## Tier 3 — perceived latency

Written in Plan 4, when both apps exist and one harness can drive them both.

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
