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
- YAML through saphyr; JSON through serde_json
- mise for tool versions and tasks; hk for git hooks and quality steps
- Bun and Node 22 for the TypeScript baseline benchmarks

## Project Architecture

| Crate / folder     | Role                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `crates/kb-domain` | The engine: entries, source files, notes Markdown, the SQLite index and its queries. No UI. |
| `crates/kb-app`    | The GPUI Kit application: a resident panel opened by a global hotkey. (Plan 3)              |
| `crates/kb-bench`  | Engine benchmarks writing the shared results schema. (Plan 2)                               |
| `bench/ts`         | The same benchmarks over the Raycast extension's TypeScript engine.                         |
| `fixtures`         | Benchmark corpora, queries and golden outputs.                                              |

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

| Command                      | Does                                                             |
| ---------------------------- | ---------------------------------------------------------------- |
| `mise run setup`             | install everything                                               |
| `mise run gate`              | all gates in order; `--fast` runs tests and clippy only          |
| `mise run fixtures`          | copy the private corpus, verify its manifest, build the 10× copy |
| `mise run goldens`           | write goldens from the TS engine                                 |
| `mise run parity`            | golden parity on the private corpus                              |
| `mise run bench:ts`          | tier 1 benchmarks of the TS engine                               |
| `mise run bench:rs <corpus>` | tier 1 benchmarks of kb-domain                                   |
| `hk check --all`             | every baseline step over the whole repository                    |

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
bun run --cwd bench/ts test     # TS bench helpers (not the linked Raycast specs)
```

Golden tests compare the Rust engine with the TypeScript one. `fixtures/sample-goldens` is committed and runs
everywhere; the private corpus's goldens stay local.

## Contributing

Work through a design spec in `docs/superpowers/specs` and a plan in `docs/superpowers/plans`. Every change passes
`mise run gate`.

## License

MIT
