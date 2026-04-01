<!-- markdownlint-disable-file -->
# KodexB — Requirements (CLI v1 MVP)

## INTRODUCTION

**KodexB** is a terminal-based personal knowledge management system. Sources
are human-editable YAML files; SQLite is a derived, rebuildable index.

The KodexB application is a Bun package at **`apps/kb`** in the monorepo
(see [design.md](design.md) for architecture).

**Phase 1 (this document):** CLI only. Six commands:

| **Command** | **Summary**                         |
| ----------- | ----------------------------------- |
| `config`    | Inspect and initialise paths        |
| `import`    | Parse YAML sources into SQLite      |
| `ls`        | List and search entries             |
| `view`      | View one entry by stable id         |
| `db`        | Database statistics                 |
| `cache` `*` | Query cache statistics / invalidate |

> `*` — `cache` is optional for MVP. Requires an implemented query cache.

---

## OUT OF SCOPE (PHASE 1)

- Commands: `show`, `copy`, `exec`, `tags`, `completion`
- TUI
- Type-specific list subcommands
- Shell completion
- Theme colouring of CLI output
- Aliases

---

## REQUIREMENT SYNTAX (EARS)

Acceptance criteria use EARS-style phrasing:

- **WHEN** _condition_, **THEN** the system **SHALL** _behaviour_.
- **IF** _condition_, **THEN** the system **SHALL** _behaviour_ (including errors).

Global options are stated once under **GLOBAL OPTIONS** and apply to all
commands unless explicitly excluded.

Traceability: each **REQUIREMENT V1-*** block maps to [design.md](design.md),
[tasks.md](tasks.md), and [gap-matrix.md](gap-matrix.md).

---

## GLOSSARY

- **Entry:** A single knowledge item — Bookmark, Command, Cheat, or Task.
- **Source files:** YAML files under the configured sources directory.
- **Config:** App configuration file; default `~/.config/kodexb/config.yaml`.
- **Database:** SQLite file; default `~/.config/kodexb/db.sqlite`.
- **Stable id:** `crc32(type + ":" + yamlKey)` — deterministic across rebuilds.
- **Emitter:** The module that formats and writes data to stdout per `--format`.
- **CLI:** Non-interactive interface implemented with KLI (`@kb/kli`).

---

## GLOBAL OPTIONS

Available on every command. Defined once in `definition.kli.ts`.

| **Flag**   | **Short** | **Type**  | **Default**                    | **Description**                |
| ---------- | --------- | --------- | ------------------------------ | ------------------------------ |
| `--config` | `-c`      | `file`    | `~/.config/kodexb/config.yaml` | Config file path               |
| `--source` | `-s`      | `file`    | `~/.config/kodexb/sources/`    | Sources directory              |
| `--db`     | `-b`      | `file`    | `~/.config/kodexb/db.sqlite`   | SQLite database path           |
| `--debug`  | `-d`      | `boolean` | `false`                        | Structured debug log to stderr |
| `--format` | `-f`      | `either`  | `pretty`                       | Output format (see below)      |

### Output format (`--format`)

| **Value** | **Short** | **Description**                           |
| --------- | --------- | ----------------------------------------- |
| `pretty`  | `-p`      | Human-readable, aligned columns (default) |
| `json`    | `-j`      | JSON array or object                      |
| `raw`     | `-r`      | TSV — one record per line, tab-separated  |

Wired by the emitter. Individual commands do not handle formatting directly.

### Debug output format

WHEN `--debug` is set, the system SHALL write structured lines to **stderr**
(never stdout) in the format:

```
ts=<ISO8601> phase=<label> label=<description> dur_ms=<number>
```

Phase labels: `config_load`, `config_reload`, `sqlite`, `import`,
`cache_hit`, `cache_miss`.

### KLI parser limitation

KLI stores one value per option key. For multiple values, use
comma-separated strings:

- `--tags=vim,sql` — AND semantics (all tags must match)
- `--types=command,cheat`

---

## PERFORMANCE TARGETS (NFR)

Performance is measured as **CLI responsiveness**: elapsed time from process
start until all intended stdout for that invocation is written.

Fixtures live under `assets/fixtures/kb/`. Threshold checks are an optional
CI step.

| **Scenario**                       | **p95 threshold** | **Fixture** | **Requirement** |
| ---------------------------------- | ----------------- | ----------- | --------------- |
| Cold `kb config` (existing files)  | < 150 ms          | `minimal`   | V1-1            |
| `kb config --setup` (empty tmpdir) | < 300 ms          | none        | V1-1            |
| `kb ls` on empty DB                | < 120 ms          | none        | V1-3            |
| `kb ls` FTS on fixture S           | < 80 ms           | `fixture-s` | V1-3            |
| `kb import` fixture S              | < 2 s             | `fixture-s` | V1-2            |
| `kb view` by id (existing)         | < 60 ms           | `fixture-s` | V1-4            |
| `kb db` after import               | < 100 ms          | `fixture-s` | V1-5            |

Measurement methodology: see [design.md](design.md) — *Performance Architecture*.

---

## REQUIREMENT V1-1: `kb config`

**User story:** As a user, I want to inspect and initialise KodexB paths so
that I know where data lives and first-run setup is a single command.

### Acceptance criteria

1. WHEN the user runs `kb config` without subflags, THEN the system SHALL
   print the resolved `config`, `source`, and `db` paths and any other
   resolved settings defined in design.
   - **Measure:** cold run p95 < 150 ms with fixture `minimal`; stdout
     contains all three paths.

2. WHEN the user runs `kb config --setup`, THEN the system SHALL:
   - Create the config file with defaults if it does not exist.
   - Create all parent directories as needed.
   - Ensure the SQLite file path is creatable (parent dirs exist).
   - Create the sources directory if absent.
   - Exit 0 on success.
   - **Measure:** second run (idempotent) exits 0 with no error; p95 < 300 ms
     on empty `$TMPDIR`.

3. WHEN the user runs `kb config --sync`, THEN the system SHALL reload the
   configuration from disk and use the new values for any subsequent
   operation in that process.
   - WHEN `--debug` is set, THEN a `config_reload` phase line SHALL appear
     on stderr.
   - **Measure:** after editing the config file, `kb config --sync && kb config`
     shows the new values; debug log includes `config_reload`.

4. IF the config file exists but is invalid, THEN the system SHALL exit 1
   and write a descriptive message to stderr including the file path and
   the offending field.
   - **Measure:** fixture `config.invalid.yaml` yields exit 1; stderr contains
     the file path.

---

## REQUIREMENT V1-2: `kb import`

**User story:** As a user, I want to import YAML sources into SQLite so that
`ls` and `view` work against the index.

### Acceptance criteria

1. WHEN the user runs `kb import` without `--source`, THEN the system SHALL
   import recursively from the resolved `globals.source` / config sources path.

2. WHEN the user runs `kb import --source <path>`, THEN the system SHALL use
   that directory instead of the configured default.

3. WHEN a file fails YAML parsing or Typia validation, THEN the system SHALL
   record the error, continue processing remaining files, and exit non-zero
   if any error occurred.
   - **Measure:** fixture with one invalid file produces a summary with
     `errors >= 1` and exit code ≠ 0.

4. WHEN import completes, THEN the system SHALL:
   - Upsert entries with stable ids per design.
   - Rebuild the FTS5 virtual table.
   - Print a summary: files processed, inserted, updated, errors.
   - **Measure:** second import without file changes is idempotent (row counts
     stable); p95 import time < 2 s for fixture S.

5. THE import pipeline SHALL follow domain rules in [design.md](design.md):
   entry types, link normalisation, note parsing, and stable id derivation.
   - **Measure:** integration tests map correctness properties to fixture
     assertions (idempotency, stable id, FTS consistency).

---

## REQUIREMENT V1-3: `kb ls`

**User story:** As a user, I want to list and search entries with filters and
pagination so that I can find what I need quickly.

### Acceptance criteria

1. WHEN the user runs `kb ls` with optional query text, THEN the system SHALL
   perform FTS5 search when text is provided and return a list formatted per
   `--format`.

2. WHEN `--tags=a,b` (comma-separated) is given, THEN results SHALL include
   only entries that have **all** listed tags (AND semantics).

3. WHEN `--types=command,cheat` (comma-separated) is given, THEN results
   SHALL be restricted to entries of those types.

4. WHEN `--limit` and `--offset` are given, THEN pagination SHALL apply to
   the result set.

5. WHEN no rows match, THEN the system SHALL exit 0 with an empty result set
   and no error.
   - **Measure:** empty DB cold run exits 0; p95 < 120 ms.

6. WHEN `--debug` is set (via global `-d`), THEN the system SHALL write to
   stderr for each query:
   - Whether the result came from cache (`cache_hit`) or SQLite (`cache_miss`).
   - The query label and duration in ms.
   - **Measure:** two consecutive `kb ls --debug` runs — first shows
     `cache_miss` (or `sqlite`), second shows `cache_hit` (once cache is
     implemented).

---

## REQUIREMENT V1-4: `kb view`

**User story:** As a user, I want to view one entry by its stable id after
finding it via `kb ls`.

### Acceptance criteria

1. WHEN the user runs `kb view <id>`, THEN the system SHALL load the entry
   by stable id and render its fields per `--format`.

2. IF the id does not exist in the database, THEN the system SHALL exit 1
   and write a descriptive message to stderr.
   - **Measure:** random id on empty DB exits 1; existing id p95 < 60 ms
     with fixture S.

---

## REQUIREMENT V1-5: `kb db`

**User story:** As a user, I want to see database statistics so that I can
verify my knowledge base is healthy.

### Acceptance criteria

1. WHEN the user runs `kb db`, THEN the system SHALL print:
   - Entry counts broken down by type.
   - Total entry count.
   - Database file path and size.
   - Output formatted per `--format`.
   - **Measure:** after import of fixture S, counts match known totals; p95
     < 100 ms.

---

## REQUIREMENT V1-6: `kb cache` `*`

> **Optional for MVP.** Requires a query cache to be implemented in the app
> service. If the cache is not implemented, this command SHALL print a message
> indicating that caching is not enabled and exit 0.

**User story:** As a user, I want to inspect and invalidate the query cache
separately from configuration reload.

### Acceptance criteria

1. WHEN the user runs `kb cache`, THEN the system SHALL print cache statistics:
   hits, misses, and current entry count.

2. WHEN the user runs `kb cache --invalidate`, THEN the system SHALL clear
   all in-memory query caches used by `ls` and related queries.
   - WHEN `--debug` is set, a subsequent `kb ls` SHALL log `cache_miss`.
   - **Measure:** two `kb ls --debug` runs after invalidate — first shows
     `cache_miss`.

**Distinction:** `kb config --sync` reloads configuration only.
`kb cache --invalidate` clears the query/result cache only. These are
independent operations.

---

## Appendix A — Comparables and backlog

Patterns worth tracking (not implementation requirements):

- **[zk](https://github.com/zk-org/zk):** stable IDs, automation-friendly
  CLI, scripting hooks.
- **[memex](https://memex-kb.sh):** hybrid search — semantic layer is
  post-FTS, Phase 3+ if ever.
- **nb / buku-style:** tag-heavy workflows — aligns with `--tags`.

**Backlog (Phase 2+):** `kb export`, dry-run import, backup/restore, schema
migration, conflict policy (YAML on disk diverges from DB), shell completion,
`show`/`copy`/`exec`, `tags` command, theme colouring.

---

## Appendix B — Legacy command matrix (deferred)

The following were in the long-term CLI sketch and remain deferred: `info`
(replaced by `config`), type-specific list subcommands, `tags`, `copy`,
`exec`, `completion`, theme colouring.