# kb native

## Project Name and Description

kb native is an experiment: a native macOS port of the [kb](https://github.com/roalcantara/kb-raycast) Raycast extension's
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
| `crates/kb-app`    | The GPUI Kit application: a resident panel opened by a global hotkey.                       |
| `crates/kb-bench`  | Engine benchmarks writing the shared results schema.                                        |
| `crates/xtask`     | Repository tasks in Rust: `report` writes `docs/experiment/report.md`.                      |
| `bench/ts`         | The same benchmarks over the Raycast extension's TypeScript engine.                         |
| `fixtures`         | Benchmark corpora, queries and golden outputs.                                              |

`kb-domain` never depends on a UI crate; the `domain-purity` hk step enforces it. See [CONTEXT.md](CONTEXT.md)
for the domain vocabulary and [docs/adr](docs/adr) for the decisions.

## Getting Started

**Quickstart.**

```bash
mise run setup        # tools, crates, TS bench dependencies, git hooks
mise run install      # build kb.app and copy it to ~/Applications
open ~/Applications/kb.app
```

Then press **⌥K** anywhere to open the panel, and **⌘R** once to build the index from your sources.

| Key  | Does                                                 |
| ---- | ---------------------------------------------------- |
| type | search titles, descriptions and notes                |
| ↑ ↓  | move the selection                                   |
| ↩    | show the entry; on the entry, run its main action    |
| ⌘↩   | run the main action: open a bookmark, copy a command |
| ⌘K   | all actions for the selected entry                   |
| ⌘P   | filter by type and tag                               |
| ⌘D   | show or hide the details pane                        |
| ⌘R   | rebuild the index                                    |
| ⌘⇧,  | open the preferences file                            |
| Esc  | back, then hide the panel                            |
| ⌘Q   | quit kb                                              |

kb has no Dock icon: it lives behind ⌥K until you quit it. To start it at login, add `~/Applications/kb.app` in
System Settings › General › Login Items. If another app holds ⌥K, kb says so when it opens.

The sources are `~/.config/kodexb/sources` unless `~/.config/kb/config.toml` says otherwise:

```toml
sources_path = "~/Work/knowledge"
```

The index lives in `~/Library/Application Support/kb-native/kb.db`; the Raycast extension's index is never
touched.

**Working on it.**

```bash
mise run gate         # every quality gate, stopping at the first failure
mise run app          # build and start the panel from the terminal; --trace logs its latencies
```

`mise run package` builds `target/packager/kb.app` and signs it ad hoc, which is enough for this machine. To give it
to someone else, sign it with a Developer ID and notarize it (`codesign --options runtime`, `xcrun notarytool`);
Gatekeeper refuses an ad hoc signature from another machine.

The TS baseline reads the Raycast repository at `$KB_TS_REPO` (default `~/Work/raycast/kb`) and never writes to
it.

## Project Structure

```text
crates/          Rust crates
bench/ts/        TypeScript baseline benchmarks and golden writer
bench/probes/    tier 2 and 3 probes: memory, CPU, size, latency, and the CGEvent driver
fixtures/        corpora, queries, goldens (private corpora are gitignored)
docs/adr/        architecture decisions
docs/experiment/ methodology, parity matrix, results, report
docs/superpowers/ design specs and implementation plans
tools/           ast-grep rules, mdschema schemas
```

## Key Features

- The kb search experience — FTS search, filters, split pane, rendered notes with highlighted code, actions,
  sync — as a native panel opened by ⌥K.
- Byte-for-byte parity with the Raycast engine's output, proven by golden tests.
- A reproducible benchmark of both implementations on the same corpus.

## Development Workflow

| Command                       | Does                                                                  |
| ----------------------------- | --------------------------------------------------------------------- |
| `mise run setup`              | install everything                                                    |
| `mise run gate`               | all gates in order; `--fast` runs tests and clippy only               |
| `mise run fixtures`           | copy the private corpus, verify its manifest, build the 10× copy      |
| `mise run goldens`            | write goldens from the TS engine                                      |
| `mise run parity`             | golden parity on the private corpus                                   |
| `mise run bench:ts`           | tier 1 benchmarks of the TS engine                                    |
| `mise run bench:rs <corpus>`  | tier 1 benchmarks of kb-domain                                        |
| `mise run bench:memory <app>` | tier 2 memory of kb or raycast                                        |
| `mise run bench:e2e <app>`    | tier 3 latency of kb or raycast                                       |
| `mise run bench:maint`        | lines, dependencies, tests and build time of both                     |
| `mise run bench:home`         | an isolated home over `fixtures/private`, index synced by `kb --sync` |
| `mise run bench:size <app>`   | tier 2 artifact size of kb or raycast                                 |
| `mise run bench:cpu <app>`    | tier 2 cold-start CPU of kb or raycast                                |
| `mise run bench:session`      | preflight, then every tier 2 and 3 run and maintainability, in order  |
| `mise run package`            | build and sign `kb.app`; `install` copies it to ~/Applications        |
| `mise run report`             | gate, parity, then `docs/experiment/report.md` from the results       |
| `hk check --all`              | every baseline step over the whole repository                         |

Measuring both apps is one sitting: set up what `docs/experiment/methodology.md` ("Session") asks, run
`mise run bench:session`, record the manual keystroke run, commit the results, then `mise run report`.

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
