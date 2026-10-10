# Context

The domain words of this repository, each with where it lives. They are kb's words; code, specs and prompts use
them and no synonyms. Locations marked _(Plan N)_ do not exist yet.

| Term              | Meaning                                                                                                                               | Lives in                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Entry             | One knowledge node users can search and open: a YAML key under an entry type. Its id is `<rel path>#<type>#<key>`.                    | `crates/kb-domain/src/entry.rs`                                                                                |
| Entry type        | The top-level YAML key an entry sits under (`commands`, `bookmarks`, `tasks`…). Unknown keys are kept, not rejected.                  | `crates/kb-domain/src/entry.rs` (`Entry::entry_type`); labels and icons in `crates/kb-app/src/presentation.rs` |
| Sources directory | Where source files are found, recursively: `sources_path` in `~/.config/kb/config.toml`, else `~/.config/kodexb/sources`.             | `crates/kb-app/src/config.rs`                                                                                  |
| Source file       | A `.yml` or `.yaml` file under the sources directory; the only source of truth, never written.                                        | `crates/kb-domain/src/source.rs`                                                                               |
| Primary content   | What an entry's main action opens or copies: its `url`, `cmd`, `cheat` or `task` field, else its key.                                 | `crates/kb-domain/src/entry.rs`                                                                                |
| Tags              | An entry's `tags` (or `tag`) labels, lowercased. Filterable; not in the full-text index.                                              | `crates/kb-domain/src/entry.rs`                                                                                |
| Index             | `kb.db`: `entries`, the `entries_fts` FTS5 table, `entry_tags` — the Raycast schema, in the app's own support directory.              | `crates/kb-domain/src/sync.rs`, `crates/kb-domain/src/schema.sql`                                              |
| Index row         | The SQLite projection of one entry, including the pre-compiled notes Markdown.                                                        | `crates/kb-domain/src/row.rs`                                                                                  |
| Notes             | An entry's documentation in whatever shape its source file used; compiled to Markdown at sync time.                                   | `crates/kb-domain/src/markdown.rs`                                                                             |
| Query             | The search text plus the filter and page window. Each word becomes an FTS5 prefix term; results are ordered by rank.                  | `crates/kb-domain/src/query.rs`                                                                                |
| Filter            | The entry types and tags a query is narrowed to: any selected type, and every selected tag.                                           | `crates/kb-domain/src/search.rs`                                                                               |
| Sync              | The manual rebuild of the index from the source files; cancellable, transactional.                                                    | `crates/kb-domain/src/sync.rs`                                                                                 |
| Sync report       | What a sync says about each source file: entries indexed, entries skipped, or why the file failed to parse.                           | `crates/kb-domain/src/report.rs`                                                                               |
| Panel             | The floating window the hotkey opens; hidden on Esc or when it loses focus.                                                           | `crates/kb-app/src/panel.rs`                                                                                   |
| Hotkey            | The global key combination that shows the panel: ⌥K.                                                                                  | `crates/kb-app/src/panel.rs`                                                                                   |
| Palette           | The ⌘K list of commands for the selected entry; each runs the same Action as its shortcut.                                            | `crates/kb-app/src/palette.rs`                                                                                 |
| Trace             | `kb --trace`: the show and keystroke latencies the app logs to stderr, each from the frame that draws the change to the one after it. | `crates/kb-app/src/trace.rs`                                                                                   |
| Package           | `kb.app`: the release binary in a bundle with no Dock icon, signed ad hoc by `mise run package`.                                      | `crates/kb-app/Cargo.toml` (`[package.metadata.packager]`)                                                     |

## Experiment

| Term       | Meaning                                                                                                   | Lives in                                    |
| ---------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Corpus     | A set of source files a run measures: `sample` (committed), `private` and `private-10x` (local only).     | `fixtures/`, `bench/ts/corpus.ts`           |
| Golden     | An output of the TypeScript engine the Rust engine must reproduce.                                        | `fixtures/*-goldens/`                       |
| Tier       | A measurement depth: 1 engine, 2 footprint, 3 perceived latency.                                          | `docs/experiment/methodology.md`            |
| Result     | One run's JSON, in the shared schema, under `docs/experiment/results/`.                                   | `bench/ts/bench.ts`                         |
| Parity row | One user-visible behaviour of the Raycast command and its status in the port.                             | `docs/experiment/parity.md`                 |
| Task       | One of the five scripted jobs whose keystrokes and time are compared on both apps (T1–T5).                | `docs/experiment/parity.md`                 |
| Probe      | A script that measures a running app from outside; `probe` is the CGEvent driver they share.              | `bench/probes/`                             |
| Report     | The generated comparison of both implementations against the success criteria.                            | `crates/xtask`, `docs/experiment/report.md` |
| Findings   | The hand-written reading of the report: why a criterion failed or went unmeasured, and what would fix it. | `docs/experiment/findings.md`               |
