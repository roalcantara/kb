# KodexB (`@kb/cli`)

**KodexB** is a terminal-based personal knowledge management system. **Source
files** are human-editable YAML under the configured sources directory;
**SQLite** is a derived, rebuildable index.

This directory is the **KodexB application package** in the monorepo
(`apps/kb`). Authoritative behaviour, architecture, and implementation
checklists live under the kb spec set:

| Document                                                      | Purpose                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| [requirements.md](../../assets/docs/specs/kb/requirements.md) | Phase 1 CLI MVP, glossary, global options, requirements V1-1 … V1-6 |
| [design.md](../../assets/docs/specs/kb/design.md)             | FCIS layers, data flow, CLI surface, DB, observability, target tree |
| [tasks.md](../../assets/docs/specs/kb/tasks.md)               | Scaffolding and feature checkpoints                                 |

Phase 1 is **CLI only** (no TUI in scope for the MVP described there).

---

## Glossary (from requirements)

| Term             | Definition                                                        |
| ---------------- | ----------------------------------------------------------------- |
| **Entry**        | A single knowledge item (e.g. Bookmark, Command, Cheat, Task).    |
| **Source files** | YAML files under the configured sources directory.                |
| **Config**       | App configuration; default `~/.config/kodexb/config.yaml`.        |
| **Database**     | SQLite file; default `~/.config/kodexb/db.sqlite`.                |
| **Stable id**    | `crc32(type + ":" + yamlKey)` — deterministic across rebuilds.    |
| **Emitter**      | Module that formats and writes **data** to stdout per `--format`. |
| **CLI**          | Non-interactive interface built with KLI (`@kb/kli`).             |

---

## Architecture (FCIS)

From [design.md](../../assets/docs/specs/kb/design.md):

| Layer         | Location                   | Responsibility                                           |
| ------------- | -------------------------- | -------------------------------------------------------- |
| Core (pure)   | `apps/kb/src/core`         | Types, parsers, validators, formatters — **no I/O**      |
| Shell (I/O)   | `apps/kb/src/shell`        | KLI commands, config load, SQLite, import, debug logging |
| CLI framework | `packages/kli` (`@kb/kli`) | Parsing, commands, middleware, optional TUI hook         |

**Orchestration:** `shell/app/app.service.ts` is the single entry for app
actions (import, list, view, stats). KLI commands call the app service only;
commands do not open SQLite directly.

**Emitter:** `shell/cli/emitter/emitter.ts` implements
`formatAndWrite(payload, format)`. It is the **only** place in the shell that
calls `console.log` for **data** output. Commands pass payloads and
`ctx.opts.format`; they do not format stdout themselves.

**Entries:** App entry is `src/index.ts` (`bun run dev` / `build` at repo root).
TTY → TUI module may load when there is no subcommand; non-TTY → CLI only.
Compiled binary includes both paths (see design for historical headless variant).

---

## CLI commands (phase 1)

| Command   | Summary                             |
| --------- | ----------------------------------- |
| `config`  | Inspect and initialise paths        |
| `import`  | Parse YAML sources into SQLite      |
| `ls`      | List and search entries             |
| `view`    | View one entry by stable id         |
| `db`      | Database statistics                 |
| `cache` * | Query cache statistics / invalidate |

\* Optional for MVP; requires an implemented query cache (see requirements V1-6).

Command registration and globals are defined in
`shell/cli/entry/definition.kli.ts`.

---

## Global options

Shared across commands unless a requirement excludes them. Full tables and
wording: [requirements.md — GLOBAL OPTIONS](../../assets/docs/specs/kb/requirements.md#global-options).

| Long       | Short | Role                                               |
| ---------- | ----- | -------------------------------------------------- |
| `--config` | `-c`  | Config file path                                   |
| `--source` | `-s`  | Sources directory                                  |
| `--db`     | `-b`  | SQLite database path                               |
| `--debug`  | `-d`  | Structured debug lines on **stderr**               |
| `--format` | `-f`  | Output format (`either` group: `-p` / `-j` / `-r`) |

### Output format (`--format`)

| Value    | Short | Description                               |
| -------- | ----- | ----------------------------------------- |
| `pretty` | `-p`  | Human-readable, aligned columns (default) |
| `json`   | `-j`  | JSON array or object                      |
| `raw`    | `-r`  | TSV — one record per line, tab-separated  |

### Debug output

When `--debug` is set, structured lines go to **stderr** (never stdout), e.g.
`ts=<ISO8601> phase=<label> label=<description> dur_ms=<number>`. Phase
labels include `config_load`, `config_reload`, `sqlite`, `import`,
`cache_hit`, `cache_miss`, and (via timing middleware) command wall time. See
[design.md — Observability](../../assets/docs/specs/kb/design.md#3-observability).

### KLI parser note

KLI stores one value per option key. For multiple tags or types, use
comma-separated strings (e.g. `--tags=vim,sql`, `--types=command,cheat`) with
AND semantics for tags as specified in requirements.

---

## Target package layout

The canonical tree is documented in [design.md — Repository structure](../../assets/docs/specs/kb/design.md#repository-structure-target).
It includes `core/config`, `core/domain/*`, `shell/app/*`, `shell/config`,
`shell/cli/commands`, `shell/cli/emitter`, `shell/cli/middleware`, and
`shell/cli/entry`.

> **Migration:** Legacy or transitional code may still live under repository
> root `src/` while moving into `apps/kb`. Treat paths under `apps/kb/src/` as
> canonical when they exist.

---

## Related packages

- **`@kb/kli`** — CLI framework (middleware, interceptors, KLI setup). Product
  behaviour and KodexB rules are **not** defined there; see
  [packages/kli/README.md](../../packages/kli/README.md) for framework usage.

---

## Development

From the **workspace root** (after `bun install`):

```sh
bun run lint
bun run typecheck
bun test
```

Scope tests to this app when paths are under `apps/kb`:

```sh
bun test apps/kb
```

---

## License

MIT.
