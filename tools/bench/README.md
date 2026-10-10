# Benchmark kit

Everything that produces the experiment's measurements, kept apart from the product so it can be deleted as one unit.
The product, its tests and the gate do not depend on it. What it produces lives elsewhere: results, report, methodology
and parity matrix in [docs/experiment/](../../docs/experiment/).

| Path         | What                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `tasks.toml` | mise tasks: `bench:*`, `fixtures`, `goldens`, `parity`, `probes`, `report` (included from `mise.toml`) |
| `kb-bench/`  | tier 1: the Rust engine benchmark (crate `kb-bench`)                                                   |
| `ts/`        | tier 1 of the TypeScript engine, and the golden writer; `ts/kb` links to the Raycast repo (read only)  |
| `probes/`    | tiers 2 and 3: memory, CPU, size, latency and ⌘↩ probes, and the CGEvent driver `probe.swift`          |
| `report/`    | `docs/experiment/report.md` from the results (crate `kb-report`)                                       |
| `fixtures/`  | `queries.json`, the private corpus's manifest; `private*` is gitignored; `sample*` link to kb-domain's |

## Use

```bash
mise run bench:setup     # link the TS engine, install the TS bench's dependencies
mise run bench:session   # tiers 2 and 3 for both apps (docs/experiment/methodology.md, "Session")
mise run report          # gate, golden parity, then docs/experiment/report.md
```

## Purge

1. Delete `tools/bench/`.
2. `Cargo.toml`: remove the two `tools/bench/…` workspace members.
3. `mise.toml`: remove the marked "Benchmark kit" block (`KB_TS_REPO`, `KB_SOURCES`, `[task_config]`).
4. `hk.pkl`: remove the marked `bench-ts-*` steps.
5. `.gitignore`: remove the marked "Benchmark kit" block.
6. Run `mise run gate`.

The engine's sample goldens stay in `crates/kb-domain/tests/fixtures/`, frozen: they are its contract. Without the kit
nothing regenerates them from the TypeScript engine. `kb --trace` and `kb --sync` stay in the app.
