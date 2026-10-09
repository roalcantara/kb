# Context

The domain words of this repository, each with where it lives. They are kb's words; code, specs and prompts use
them and no synonyms. Locations marked _(Plan N)_ do not exist yet.

| Term              | Meaning                                                                                                                   | Lives in                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Entry             | One knowledge node users can search and open: a YAML key under an entry type. Its id is `<rel path>#<type>#<key>`.        | `crates/kb-domain/src/entry.rs`                                                                                                       |
| Entry type        | The top-level YAML key an entry sits under (`commands`, `bookmarks`, `tasks`…). Unknown keys are kept, not rejected.      | `crates/kb-domain/src/entry.rs` (`Entry::entry_type`; `type` is a Rust keyword, and the type list itself is UI vocabulary for Plan 3) |
| Sources directory | Where source files are found, recursively: `sources_path` in `~/.config/kb/config.toml`, else `~/.config/kodexb/sources`. | `crates/kb-app/src/config.rs` _(Plan 3)_                                                                                              |
| Source file       | A `.yml` or `.yaml` file under the sources directory; the only source of truth, never written.                            | `crates/kb-domain/src/source.rs`                                                                                                      |
| Primary content   | What an entry's main action opens or copies: its `url`, `cmd`, `cheat` or `task` field, else its key.                     | `crates/kb-domain/src/entry.rs`                                                                                                       |
| Tags              | An entry's `tags` (or `tag`) labels, lowercased. Filterable; not in the full-text index.                                  | `crates/kb-domain/src/entry.rs`                                                                                                       |
| Index             | `kb.db`: `entries`, the `entries_fts` FTS5 table, `entry_tags` — the Raycast schema, in the app's own support directory.  | `crates/kb-domain/src/sync.rs`, `crates/kb-domain/src/schema.sql`                                                                     |
| Index row         | The SQLite projection of one entry, including the pre-compiled notes Markdown.                                            | `crates/kb-domain/src/row.rs`                                                                                                         |
| Notes             | An entry's documentation in whatever shape its source file used; compiled to Markdown at sync time.                       | `crates/kb-domain/src/markdown.rs`                                                                                                    |
| Query             | The search text plus the filter and page window. Each word becomes an FTS5 prefix term; results are ordered by rank.      | `crates/kb-domain/src/query.rs`                                                                                                       |
| Filter            | The entry types and tags a query is narrowed to: any selected type, and every selected tag.                               | `crates/kb-domain/src/search.rs`                                                                                                      |
| Sync              | The manual rebuild of the index from the source files; cancellable, transactional.                                        | `crates/kb-domain/src/sync.rs`                                                                                                        |
| Sync report       | What a sync says about each source file: entries indexed, entries skipped, or why the file failed to parse.               | `crates/kb-domain/src/report.rs`                                                                                                      |
| Panel             | The floating window the hotkey opens; hidden on Esc or when it loses focus.                                               | `crates/kb-app/src/panel.rs` _(Plan 3)_                                                                                               |
| Hotkey            | The global key combination that shows the panel.                                                                          | `crates/kb-app/src/hotkey.rs` _(Plan 3)_                                                                                              |

## Experiment

| Term       | Meaning                                                                                               | Lives in                          |
| ---------- | ----------------------------------------------------------------------------------------------------- | --------------------------------- |
| Corpus     | A set of source files a run measures: `sample` (committed), `private` and `private-10x` (local only). | `fixtures/`, `bench/ts/corpus.ts` |
| Golden     | An output of the TypeScript engine the Rust engine must reproduce.                                    | `fixtures/*-goldens/`             |
| Tier       | A measurement depth: 1 engine, 2 footprint, 3 perceived latency.                                      | `docs/experiment/methodology.md`  |
| Result     | One run's JSON, in the shared schema, under `docs/experiment/results/`.                               | `bench/ts/bench.ts`               |
| Parity row | One user-visible behaviour of the Raycast command and its status in the port.                         | `docs/experiment/parity.md`       |
