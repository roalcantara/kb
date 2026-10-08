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

| Case                | Warm-up | Samples | What one sample is                                                               |
| ------------------- | ------- | ------- | -------------------------------------------------------------------------------- |
| `scan`              | 3       | 20      | find and parse every source file into entries                                    |
| `markdown`          | 3       | 20      | build the notes Markdown of every entry                                          |
| `sync-cold`         | 2       | 10      | full sync into a database that does not exist                                    |
| `sync-warm`         | 2       | 10      | full sync into an existing database                                              |
| `search-app/<q>`    | 20      | 200     | the app's path: open read-only, run the rendered SQL, close, map rows to entries |
| `search-engine/<q>` | 50      | 500     | the prepared statement on one open connection                                    |

The TS engine runs under Node 22 — what Raycast runs extensions on — and under Bun for reference. The machine is
on AC power with other heavy apps closed; results record the power source.

## Tier 2 — footprint

- RSS, sampled once a second for 30 s by `bench/probes/rss.sh`, in three scenarios: idle with the window closed,
  search open, and after 100 scripted queries (`bench/probes/drive-queries.sh`).
- Raycast is measured two ways: the extension worker alone (`RAYCAST_WORKER`) and the whole app with its helpers
  (`RAYCAST_ALL`), because the native app replaces both for this use.
- Process patterns used on this machine: `RAYCAST_ALL=(Raycast\.app|Raycast Backend|com\.raycast)`,
  `RAYCAST_WORKER=Raycast Backend`.
- Artifact size: the `ray build` output, which bundles every runtime dependency.
- Cold-start CPU: the CPU time the processes have used from a fresh launch until search results first show.

## Tier 3 — perceived latency

Written in Plan 4, when both apps exist and one harness can drive them both.

## Results

One JSON file per run in `docs/experiment/results/`, named `tier<N>-<implementation>-<…>-<UTC stamp>.json`. Tier 1
files carry every sample.
