<!-- markdownlint-disable-file -->
# KodexB — Implementation Tasks

Aligned with [requirements.md](requirements.md) **V1-1 … V1-6** and
[design.md](design.md). All paths assume the target layout under **`apps/kb`**
with the shared CLI framework at **`packages/kli`** (`@kb/kli`).

---

## CONVENTIONS

- [ ] unchecked — work to do
- [x] done
- Each **Checkpoint** is a demo-able command or automated assertion.
- Each **Performance** task records a baseline and fails CI if over threshold.
- Tasks marked `*` are optional for MVP.

> **Migration note:** If the CLI still runs from repository root `src/` during
> migration, complete the `apps/kb` scaffolding first (new Bun package, then
> move or re-export) before treating paths under `apps/kb/src/` as canonical
> on disk.

---

## REQUIREMENT 0 — Scaffolding, KLI wiring, and shared infrastructure

**Value delivered:** `kb --help` lists all six commands; emitter and format
flag work end-to-end.

- [x] Bun package at `apps/kb` with `mise.toml`, `biome.json`, `tsconfig.json`
- [x] Production entry `apps/kb/src/shell/cli/entry/main.headless.ts`
- [x] Dev entry `apps/kb/src/shell/index.ts`
- [x] All six commands registered in
      `apps/kb/src/shell/cli/entry/definition.kli.ts`
- [x] Placeholder `greet` / `info` commands removed

- [ ] **1. Implement the emitter**
  - [ ] Create `apps/kb/src/shell/cli/emitter/formats.ts`
        — `Format` type: `'pretty' | 'json' | 'raw'`
  - [ ] Create `apps/kb/src/shell/cli/emitter/emitter.ts`
        — `formatAndWrite(payload: unknown, format: Format): void`
  - [ ] `pretty`: aligned columns via a simple column formatter
  - [ ] `json`: `JSON.stringify(payload, null, 2)`
  - [ ] `raw`: one record per line, fields tab-separated
  - [ ] Emitter is the ONLY place in shell that calls `console.log` for data

- [ ] **2. Wire `--format` global in KLI definition**
  - [ ] Add `format` as an `either` global in `definition.kli.ts`:
        `-p` / `--pretty`, `-j` / `--json`, `-r` / `--raw`; default `pretty`
  - [ ] Pass resolved `format` from `ctx.opts.format` into emitter in each
        command

- [ ] **3. Implement timing middleware**
  - [ ] Create `apps/kb/src/shell/cli/middleware/timing.ts`
  - [ ] When `ctx.opts.debug` is true, emit `phase=command` line to stderr
        with total wall time after `next()`

- [ ] **Checkpoint:** `kb --help` lists `config`, `import`, `ls`, `view`,
      `db`, `cache`; `kb ls --format=json` produces `[]` on empty DB; debug
      line appears on stderr with `--debug`

---

## REQUIREMENT 1 — `kb config` (V1-1)

**Value delivered:** User can inspect resolved paths, initialise the
directory structure, and reload config without restarting.

- [ ] **1. Core config schema and loader**
  - [ ] Create `apps/kb/src/core/config/config.types.ts`
        — `ResolvedConfig` type with Typia JSDoc tags
  - [ ] Create `apps/kb/src/core/config/config.defaults.ts`
        — `DEFAULT_CONFIG` constant and `DEFAULT_CONFIG_PATH`
  - [ ] Create `apps/kb/src/shell/config/config.loader.ts`
        — `loadConfig(path?: string): Promise<ResolvedConfig>`
  - [ ] `loadConfig` SHALL expand `~` and `$VAR` in all path fields
  - [ ] `loadConfig` SHALL validate with Typia; exit 1 on invalid config
  - [ ] `loadConfig` SHALL create the file with defaults if missing
  - [ ] Write unit tests: invalid fixture → error; missing file → creates with
        defaults; path expansion correct

- [ ] **2. Implement `config --setup`**
  - [ ] Create all parent directories for config, db, and sources paths
  - [ ] Idempotent — second run exits 0 with no error

- [ ] **3. Implement `config --sync`**
  - [ ] Force a fresh `loadConfig()` call and update `ctx.deps.config`
  - [ ] Emit `phase=config_reload` to stderr when `--debug`

- [ ] **4. Wire `config.command.ts`**
  - [ ] `kb config` (no subflag): print resolved paths via emitter
  - [ ] `kb config --setup`: run setup, print summary
  - [ ] `kb config --sync`: reload, print confirmation

- [ ] **Checkpoint:** `kb config` prints three paths; `kb config --setup`
      is idempotent; `kb config --sync --debug` emits `config_reload`
- [ ] **Performance:** record p95 baseline — cold `kb config` < 150 ms
      with fixture `minimal`; `--setup` < 300 ms on empty `$TMPDIR`

---

## REQUIREMENT 2 — `kb import` (V1-2)

**Value delivered:** User can import YAML source files into SQLite and verify
the result.

- [ ] **1. Database schema and client**
  - [ ] Create `apps/kb/src/shell/app/db/schema.ts` (Drizzle or `bun:sqlite`)
        — `knowledges` table + FTS5 virtual table `knowledges_fts`
  - [ ] Create `apps/kb/src/shell/app/db/client.ts`
        — `openDatabase(path: string)`: accepts `:memory:` for tests

- [ ] **2. Core domain types**
  - [ ] Create `apps/kb/src/core/domain/types/entry.types.ts`
        — `Entry`, `EntryType`, `LinkItem`, `NoteBlock`

- [ ] **3. Core parsers**
  - [ ] Create `apps/kb/src/core/domain/parsers/link.parser.ts`
        — normalise bare URL strings and `{ Title: url }` objects
  - [ ] Create `apps/kb/src/core/domain/parsers/note.parser.ts`
        — `md`/`markdown` keys → raw markdown; other keys → fenced code block
  - [ ] Create `apps/kb/src/core/domain/parsers/entry.parser.ts`
        — `parseYamlFile(path, content)` → `Entry[]`
        — `deriveId(type, key)` → `crc32(type + ":" + key)`
  - [ ] Write unit tests for all three parsers (no I/O, plain data in/out)

- [ ] **4. Entry repository**
  - [ ] Create `apps/kb/src/shell/app/db/entry.repository.ts`
        — `upsert(entry)`, `rebuildFts()`, `findAll(opts)`, `findById(id)`
  - [ ] Write integration tests using `:memory:` SQLite

- [ ] **5. Import service**
  - [ ] Create `apps/kb/src/shell/app/import.service.ts`
        — walk directory, parse, validate, upsert, rebuild FTS
        — collect errors without halting on first failure
        — return `{ filesProcessed, inserted, updated, errors[] }`

- [ ] **6. Wire `import.command.ts`**
  - [ ] Call import service with resolved source path
  - [ ] Print summary via emitter
  - [ ] Exit non-zero if any errors occurred

- [ ] **7. Add fixtures**
  - [ ] Create `assets/fixtures/kb/fixture-s/` — ~500 mixed entries
  - [ ] Create `assets/fixtures/kb/config.invalid.yaml` — invalid config
  - [ ] Create `assets/fixtures/kb/minimal/` — smallest valid config

- [ ] **Checkpoint:** `kb import --source assets/fixtures/kb/fixture-s`
      exits 0; `kb ls` returns non-zero rows; second import is idempotent
- [ ] **Performance:** record p95 — fixture S import < 2 s; idempotent
      second run row counts stable

---

## REQUIREMENT 3 — `kb ls` (V1-3)

**Value delivered:** User can list and search entries with filters.

- [ ] **1. App service list method**
  - [ ] Create `apps/kb/src/shell/app/app.service.ts`
        — `list(opts: ListOpts): Promise<Entry[]>`
  - [ ] `ListOpts`: `{ query?, tags?, types?, limit?, offset? }`
  - [ ] Tags: AND semantics (split comma-separated string, match all)
  - [ ] Types: filter to given entry types (split comma-separated string)
  - [ ] FTS5 when `query` is present; plain query otherwise

- [ ] **2. Optional query cache**
  - [ ] Simple `Map<string, Entry[]>` keyed by normalised query string
  - [ ] Emit `phase=cache_hit` or `phase=cache_miss` to stderr when `--debug`
  - [ ] `cache_miss` always on first call; `cache_hit` on identical repeat call

- [ ] **3. Wire `list.command.ts`** (registered as `ls`)
  - [ ] Parse comma-separated `--tags` and `--types` into arrays
  - [ ] Pass `--limit` and `--offset` to service
  - [ ] Format result via emitter
  - [ ] Exit 0 with empty result when no matches

- [ ] **4. Tests**
  - [ ] Empty DB → exit 0, empty array
  - [ ] `--debug` stderr lines match `phase=(cache_hit|cache_miss|sqlite)`

- [ ] **Checkpoint:** `kb ls` on empty DB exits 0; `kb ls query --tags=a,b
      --types=command` filters correctly; `--debug` shows phase lines
- [ ] **Performance:** record p95 — empty DB cold < 120 ms; FTS on
      fixture S < 80 ms

---

## REQUIREMENT 4 — `kb view` (V1-4)

**Value delivered:** User can view a single entry by its stable id.

- [ ] **1. App service view method**
  - [ ] Add `view(id: number): Promise<Entry | null>` to `app.service.ts`

- [ ] **2. Wire `view.command.ts`**
  - [ ] Accept `<id>` as positional arg
  - [ ] Exit 1 with descriptive stderr message if not found
  - [ ] Format result via emitter

- [ ] **3. Tests**
  - [ ] Missing id → exit 1
  - [ ] Existing id → exit 0, correct fields in output

- [ ] **Checkpoint:** `kb view <id>` on a known entry exits 0 and prints
      fields; random id exits 1
- [ ] **Performance:** record p95 — existing id < 60 ms with fixture S

---

## REQUIREMENT 5 — `kb db` (V1-5)

**Value delivered:** User can verify the database is healthy and see counts.

- [ ] **1. App service stats method**
  - [ ] Add `stats(): Promise<DbStats>` to `app.service.ts`
  - [ ] `DbStats`: `{ total, byType: Record<EntryType, number>, path, sizeBytes }`

- [ ] **2. Wire `db.command.ts`**
  - [ ] Call `app.stats()`, format via emitter

- [ ] **3. Tests**
  - [ ] After import of fixture S, counts match known totals

- [ ] **Checkpoint:** `kb db` after fixture S import shows correct counts
      per type; `--format=json` produces a valid JSON object
- [ ] **Performance:** record p95 — `kb db` < 100 ms after fixture S

---

## REQUIREMENT 6 — `kb cache` `*` (V1-6)

> **Optional for MVP.** Implement only if the query cache (REQ 3, step 2)
> is in place. If not, `kb cache` SHALL print "caching not enabled" and exit 0.

**Value delivered:** User can inspect and clear the query cache.

- [ ] **1. App service cache methods**
  - [ ] Add `cacheStats(): CacheStats` and `invalidateCache(): void` to
        `app.service.ts`
  - [ ] `CacheStats`: `{ hits, misses, entries }`

- [ ] **2. Wire `cache.command.ts`**
  - [ ] `kb cache`: print stats via emitter
  - [ ] `kb cache --invalidate`: clear cache, confirm via emitter

- [ ] **3. Tests**
  - [ ] Two `kb ls --debug` runs after invalidate — first `cache_miss`,
        second `cache_hit`

- [ ] **Checkpoint:** `kb cache` prints stats; `kb cache --invalidate`
      followed by `kb ls --debug` shows `cache_miss`
- [ ] **Performance:** automated test asserts `cache_miss` on first post-invalidate
      query

---

## Documentation and traceability

- [x] `gap-matrix.md` — REQ × code × doc (including legacy REQ 0–10)
- [x] `sdd-review-report.md` — Keep / Change / Add + decision record
- [ ] Update gap-matrix "code support" column after each milestone

---

## Notes

- **Performance tasks:** add a `mise` task or CI job that runs fixture commands
  and fails if over threshold — optional until baselines are recorded.
- **TUI:** no tasks here; Phase 2.
- **`cache` command:** marked `*` throughout — implement after the query cache
  exists, not before.