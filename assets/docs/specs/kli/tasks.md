<!-- markdownlint-disable-file -->
# IMPLEMENTATION PLAN: kli

## OVERVIEW

- This plan follows **value-driven development** — each REQUIREMENT delivers
  something immediately usable by the consumer app.
- Each checkpoint is a concrete, runnable verification.
- Tasks marked `*` are optional and can be deferred without blocking the
  consumer app.
- REQs 0–6 (the full CLI) are completable in one focused session.
- REQ 7 (TUI) is explicitly deferred to phase 2.

---

## TASKS

### REQUIREMENT 0 — Workspace Scaffolding

**Value Delivered:** `import { withCli } from 'kli'` resolves in the consumer
app with no TypeScript errors.

- [ ] **1. Initialise Bun workspace**
  - [x] Create workspace root `package.json`:
    ```json
    { "name": "kb-workspace", "private": true, "workspaces": ["packages/*"] }
    ```
  - [x] Create `catalog.yaml` at workspace root _(equivalent: Bun
        `workspaces.catalogs` in root `package.json`)_:
    ```yaml
    dependencies:
      "@biomejs/biome": "^1.9.0"
      "@types/bun":     "^1.2.0"
      "typescript":     "^5.7.0"
    ```
  - [x] Create `packages/kli/package.json`:
    ```json
    {
      "name": "kli", "version": "0.1.0",
      "module": "src/index.ts",
      "exports": { ".": "./src/index.ts", "./testing": "./src/testing.ts" },
      "dependencies": { "neverthrow": "^8.0.0", "radash": "^12.0.0" },
      "peerDependencies": { "@opentui/core": "*", "@opentui/solid": "*", "solid-js": "*" },
      "devDependencies": { "@biomejs/biome": "catalog:", "@types/bun": "catalog:", "typescript": "catalog:" }
    }
    ```
  - [ ] Create `/package.json` with
        `"kli": "workspace:*"` in `dependencies`
  - [x] Create `tsconfig.base.json` at workspace root _(equivalent: root
        `tsconfig.json` used as shared base)_:
    ```json
    {
      "compilerOptions": {
        "strict": true, "target": "ESNext", "module": "ESNext",
        "moduleResolution": "bundler", "jsx": "react-jsx",
        "jsxImportSource": "solid-js", "skipLibCheck": true,
        "verbatimModuleSyntax": true
      }
    }
    ```
  - [x] Create `packages/kli/tsconfig.json` extending base
  - [ ] Create `/tsconfig.json` extending base
  - [x] Create `biome.json` at workspace root _(equivalent: `biome.jsonc`)_
  - [x] Create `mise.toml` at workspace root _(equivalent: root tasks include
        the required lint/typecheck/test flows)_:
    - `test`:      `bun test --filter 'packages/*'`
    - `test:kli`:  `bun test packages/kli`
    - `lint`:      `biome check packages/`
    - `typecheck`: `bun tsc --noEmit`
  - [x] Run `bun install` — verify no errors
  - _Foundational — all subsequent tasks depend on this_

- [ ] **2. Create kli skeleton**
  - [ ] Create `packages/kli/src/types.ts` — all exported types:
        `ArgDef`, `ArgsDef`, `OptDef`, `OptsDef`, `EitherDef`, `ScalarOptDef`,
        `GlobalsDef`, `Ctx`, `Middleware`, `Command`, `CliInstance`,
        `ResolveArgs`, `ResolveOpts`
  - [ ] Create `packages/kli/src/index.ts` — stub exports for all public API:
        `withCli`, `withCommand`, `withTui`, `run`
  - [ ] Create `packages/kli/src/testing.ts` — stub exports for:
        `testCommand`, `testMiddleware`
  - [ ] Verify `import { withCli } from 'kli'` resolves in kodexb
  - [ ] Verify `import { testCommand } from 'kli/testing'` resolves in kodexb
  - _Unblocks consumer app scaffolding immediately_

- [ ] **3. Checkpoint**
  - [x] `bun install` — clean, no errors
  - [x] `bun run typecheck` — no errors
  - [x] `bun run lint` — no errors
  - [ ] Both `kli` entry points resolve from consumer app

---

### REQUIREMENT 1 — Option and Argument Parsing

**Value Delivered:** `withCli` globals and `withCommand` opts/args are parsed
from argv into a typed, structured result.

- [x] **1. Implement `parseArgv`**
  - [x] Create `packages/kli/src/parse-argv.ts` _(equivalent:
        `packages/kli/src/parse_argv.ts`)_
  - [x] Extract command name: first non-flag token in argv
  - [x] Parse long flags: `--name=value` and `--name value`
  - [x] Parse short flags: `-x value` and `-x=value` via schema `short` fields
  - [x] Parse `either` groups: each key in `either` is a valid short flag;
        resolve to the corresponding value
  - [x] Parse boolean flags: presence = `true`, `--no-name` = `false`
  - [x] Parse variadic args: `name...` keys collect remaining positional tokens
        into `string[]`
  - [x] Collect positional tokens into named args by declaration order
  - [x] Coerce values by declared `type`: string→string, number→number,
        boolean→boolean
  - [x] Expand `~` and `$VAR` for `type: 'file'` values
  - [x] Apply `env` fallback: when flag absent, check `process.env[env]`
        _(equivalent: injected `env` map, defaulting to `Bun.env`)_
  - [x] Apply `default` fallback: when flag absent and no env match
  - [x] Return structured `ParseResult` — never throws
  - [x] Use `radash` utilities for internal list operations
  - _Requirements: 3.1–3.6, 4.1–4.10_

- [x] **2. Write unit tests for `parseArgv`**
  - [x] Create `packages/kli/src/__tests__/parse-argv.spec.ts`
        _(equivalent: `packages/kli/src/__tests__/parse_argv.spec.ts`)_
  - [x] Test: `--config=/path` → `opts.config === '/path'`
  - [x] Test: `--config /path` → `opts.config === '/path'`
  - [x] Test: `-c /path` → `opts.config === '/path'`
  - [x] Test: `--limit 50` → `opts.limit === 50` (number)
  - [x] Test: `--verbose` → `opts.verbose === true` (boolean)
  - [x] Test: `--no-verbose` → `opts.verbose === false`
  - [x] Test: `-p` → `opts.format === 'pretty'` (either)
  - [x] Test: `--pretty` → `opts.format === 'pretty'` (either long form)
  - [x] Test: `--format json` → `opts.format === 'json'` (either explicit)
  - [x] Test: `-p -j` → error result (either mutual exclusivity)
  - [x] Test: `--config ~/file` → `~` expanded to `$HOME`
  - [x] Test: `env` fallback used when flag absent
  - [x] Test: `default` used when flag and env both absent
  - [x] Test: command name extracted correctly
  - [x] Test: positional args collected by declaration order
  - [x] Test: variadic arg collects remaining tokens into array
  - [x] Test: unknown flags silently ignored
  - _All tests pass: `bun test packages/kli`_

- [x] **3. Checkpoint**
  - [x] All `parse-argv.spec.ts` tests pass
        _(equivalent: `parse_argv.spec.ts`)_
  - [x] `bun run typecheck` — no errors

---

### REQUIREMENT 2 — Validation

**Value Delivered:** Invalid input is caught before middleware or handlers run,
with clear per-error messages.

- [x] **1. Implement `validate`**
  - [x] Create `packages/kli/src/validate.command.ts` _(equivalent:
        `packages/kli/src/validate_command.ts`)_
  - [x] Accept `ParseResult`, command definition, and globals schema
  - [x] Return `Result<ResolvedCtxData, string[]>` via `neverthrow`
  - [x] Check required args: missing → error naming the arg
  - [x] Check required opts: missing, no default, no env → error naming the opt
  - [x] Check `either` conflicts: multiple flags from same group → error
  - [x] Check `file` type: value must be non-empty after expansion
  - [x] Merge global opts and local opts — local wins on conflict
  - [x] Collect all errors before returning — never stop at first
  - _Requirements: 3.4, 4.6, 4.7, 6.1.6–6.1.7_

- [x] **2. Write unit tests for `validate`**
  - [x] Create `packages/kli/src/validate.command.spec.ts` _(equivalent:
        `packages/kli/src/validate_command.spec.ts`)_
  - [x] Test: all required args present → `ok` result
  - [x] Test: required arg absent → `err` result, message names the arg
  - [x] Test: required opt absent (no default, no env) → `err`, names the opt
  - [x] Test: `either` conflict → `err`, names the group
  - [x] Test: multiple errors → all collected, not just first
  - [x] Test: global and local opts merged — local wins
  - [x] Test: valid input → `ok` with fully merged ctx data
  - _All tests pass_

- [x] **3. Checkpoint**
  - [x] All `validate.command.spec.ts` tests pass _(equivalent:
        `validate_command.spec.ts`)_
  - [x] `bun run typecheck` — no errors

---

### REQUIREMENT 3 — `withCommand`, `withCli`, `withTui`

**Value Delivered:** Consumer app can declare its commands, globals, and CLI
instance with correct types throughout.

- [x] **1. Implement `withCommand`**
  - [x] Create `packages/kli/src/with.command.ts` _(equivalent:
        `packages/kli/src/with_command.ts`)_
  - [x] Return def unchanged — identity function
  - [x] Export from `packages/kli/src/index.ts`
  - _Requirements: 2.1–2.8_

- [x] **2. Implement `withCli`**
  - [x] Create `packages/kli/src/with.cli.ts` _(equivalent:
        `packages/kli/src/with_cli.ts`)_
  - [x] Read `name`, `version`, `description` from consumer `package.json` via
        consumer-provided `packageJson` input
  - [x] Accept `globals`, `deps`, `middleware`, `commands`
  - [x] Return typed `CliInstance`
  - [x] Export from `packages/kli/src/index.ts`
  - _Requirements: 1.1–1.5_

- [x] **3. Implement `withTui`**
  - [x] Create `packages/kli/src/with.tui.ts` _(equivalent:
        `packages/kli/src/with_tui.ts`)_
  - [x] Accept `CliInstance` and Solid component
  - [x] Attach component to `cli.tui`
  - [x] Export from `packages/kli/src/index.ts`
  - _Requirements: 8.3_

- [x] **4. Implement `help.command.ts`**
  - [x] Create `packages/kli/src/help.command.ts` _(equivalent:
        `packages/kli/src/help_command.ts`)_
  - [x] `printHelp(cli, commands)`:
    - Line 1: `name version · description`
    - Line 2: `Usage: name <command> [opts]`
    - Commands section: name + desc, column-aligned
    - Global opts section: short + long + desc + default + env, aligned
  - [x] `printCommandHelp(cli, command, name)`: same + command-local opts and args
  - [x] `printVersion(cli)`: `name version`
  - [x] All output to stdout
  - [x] Fixed format — no customisation API
  - _Requirements: 7.1–7.6_

- [x] **5. Write unit tests for `withCommand`**
  - [x] Test: returned object has correct `desc`, `args`, `opts`, `run`
  - [x] Test: `run` is the exact function reference passed in
  - [x] Test: `middleware` attached correctly when provided
  - [x] Test: `middleware` is `undefined` when not provided
  - _All tests pass_

- [x] **6. Implement consumer command and CLI**
  - [x] Create `/src/shell/commands/info.command.ts` using `withCommand` from `kli`
  - [x] Create `/src/shell/deps.factory.ts` with `buildDeps()` from consumer app
        dependencies
  - [x] Create `/src/index.ts` using `withCli` from `kli` — with TTY stub:
        `if (process.stdout.isTTY && !command) { console.log('TUI phase 2'); process.exit(0) }`
        _(equivalent: consumer CLI created in `src/shell/cli.ts`)_
  - [x] Update `index.ts` to import the cli created in the previous step and call `run` on it
        _(equivalent: `runMinimalCli` adapter via `runCli`)_
  - [x] Run `Bun index.ts` and ensure it runs the command and prints the config
  - _Requirements: 1.1–1.5, 2.1–2.8_

- [x] **7. Checkpoint**
  - [x] `withCommand` types infer correctly — no `any` in handler
  - [x] `withCli` types flow through — `ctx.deps` is `AppDeps` in handler
  - [x] `bun run typecheck` — no errors across workspace

---

### REQUIREMENT 4 — `run`

**Value Delivered:** `bun dev info` runs end-to-end. Help and version work.

- [ ] **1. Implement `run`**
  - [ ] Create `packages/kli/src/run.command.ts`
  - [ ] Step 1: `parseArgv(process.argv, cli.globals, cli.commands)`
  - [ ] Step 2: `parsed.help` → `printHelp` + exit 0
  - [ ] Step 3: `parsed.version` → `printVersion` + exit 0
  - [ ] Step 4: no command + TTY + `cli.tui` → `startTui` (stub for now)
  - [ ] Step 5: no command → `printHelp` + exit 0
  - [ ] Step 6: unknown command → stderr + exit 1
  - [ ] Step 7: `validate(parsed, command, cli.globals)` → if `isErr()`, print
        all errors + exit 1
  - [ ] Step 8: build `ctx = { args, opts, deps: cli.deps, raw }`
  - [ ] Step 9: `runChain([...cli.middleware, ...command.middleware], ctx, handler)`
  - [ ] Catch thrown errors → stderr with command name + exit 1
  - [ ] `runChain`: recursive async middleware executor
  - [ ] Export from `packages/kli/src/index.ts`
  - _Requirements: 6.1–6.4_

- [ ] **2. Write unit tests for `run`**
  - [ ] Create `packages/kli/src/run.command.spec.ts`
  - [ ] Test: known command → handler called with correct ctx
  - [ ] Test: `--help` → handler NOT called, exit 0
  - [ ] Test: no command → help printed, exit 0
  - [ ] Test: `--version` → version printed, exit 0
  - [ ] Test: unknown command → exit 1
  - [ ] Test: validation failure → exit 1, all errors printed
  - [ ] Test: handler throws → exit 1, stderr contains command name
  - [ ] Test: global middleware runs before handler
  - [ ] Test: per-command middleware runs after global, before handler
  - [ ] Test: middleware without `next()` → handler NOT called
  - [ ] Test: middleware throws → exit 1
  - [ ] Test: `ctx.deps` is exactly the object passed to `withCli`
  - [ ] Test: `ctx.opts` contains merged global + local opts
  - _All tests pass_

- [ ] **3. Checkpoint — end-to-end**
  - [ ] `bun run index.ts info` → prints config
  - [ ] `bun run index.ts info --format=json` → valid JSON
  - [ ] `bun run index.ts` → prints help
  - [ ] `bun run index.ts --help` → prints help
  - [ ] `bun run index.ts --version` → prints version
  - [ ] `bun run index.ts unknown` → exit 1 with message
  - [ ] `bun run index.ts info --config=missing.yaml` → → exit 1 from `buildDeps`

---

### REQUIREMENT 5 — Middleware

**Value Delivered:** Cross-cutting concerns work across all commands without
touching handlers.

- [ ] **1. Verify middleware chain in `run`**
  - [ ] Global middleware runs in declaration order
  - [ ] Per-command middleware runs after global, before handler
  - [ ] Short-circuit (no `next()`) stops remaining chain and handler
  - [ ] `ctx.deps` fully typed in middleware
  - _Requirements: 5.1–5.9 — covered by `run` tests above_

- [ ] **2. Implement consumer middleware**
  - [ ] Create `src/shell/middleware/timing.middleware.ts`
  - [ ] Print execution time to stderr when `ctx.opts.verbose` is true
  - [ ] Register in `withCli` middleware array
  - _Requirements: 5.3, 5.5_

- [ ] **3. Checkpoint**
  - [ ] `bun run src/shell/commands/info.command.ts --verbose` → timing printed
  - [ ] Middleware without `next()` stops the command from running

---

### REQUIREMENT 6 — Testing Utilities

**Value Delivered:** Consumer commands and middleware are unit-testable without
spawning processes.

- [ ] **1. Implement `testCommand`**
  - [ ] Create `packages/kli/src/testing.middleware.ts`
  - [ ] Mock `console.log` → collect into `stdout` buffer
  - [ ] Mock `console.error` → collect into `stderr` buffer
  - [ ] Call `command.run(ctx)` directly
  - [ ] Restore console after resolve or reject
  - [ ] Return `{ stdout, stderr, exitCode }` — 0 on resolve, 1 on throw
  - _Requirements: 9.1–9.6_

- [ ] **2. Implement `testMiddleware`**
  - [ ] In same file as `testCommand`
  - [ ] Call `middleware(ctx, next)` with a no-op `next` that sets
        `nextCalled = true`
  - [ ] Return `{ stdout, stderr, exitCode, nextCalled }`
  - _Requirements: 9.2, 9.5_

- [ ] **3. Create `ctx` factory in consumer**
  - [ ] Create `/src/__tests__/factories/ctx.factory.ts`
  - [ ] `makeCtx(overrides?)` — returns a complete `Ctx` with test defaults
  - [ ] `makeDeps(overrides?)` — returns a minimal `AppDeps` for testing

- [ ] **4. Write unit tests for testing utilities**
  - [ ] Create `packages/kli/src/testing.middleware.spec.ts`
  - [ ] Test: successful command → `exitCode === 0`, stdout captured
  - [ ] Test: throwing command → `exitCode === 1`, stderr has message
  - [ ] Test: console restored after success
  - [ ] Test: console restored after throw
  - [ ] Test: `testMiddleware` with `next()` → `nextCalled === true`
  - [ ] Test: `testMiddleware` without `next()` → `nextCalled === false`
  - _All tests pass_

- [ ] **5. Write consumer command tests**
  - [ ] Create `/src/shell/commands/info.command.spec.ts`
  - [ ] Test: `format=json` → valid JSON, `exitCode === 0`
  - [ ] Test: `format=yaml` → valid YAML, `exitCode === 0`
  - [ ] Test: `format=raw` → TSV rows, `exitCode === 0`
  - _All tests pass_

- [ ] **6. Checkpoint — full suite green**
  - [ ] `bun test packages/kli` → all pass
  - [ ] `bun test packages/kodexb` → all pass
  - [ ] `bun run lint` → no errors
  - [ ] `bun run typecheck` → no errors

---

### REQUIREMENT 7 — TUI Bootstrap `*` (Phase 2 — defer until CLI is complete)

**Value Delivered:** `kb` with no arguments opens the Solid/OpenTUI TUI.

- [ ] **1. Install TUI peer dependencies in consumer**
  - [ ] `bun add @opentui/core @opentui/solid solid-js` in `packages/kodexb`
  - [ ] Verify `jsxImportSource: "solid-js"` compiles TSX
  - _Requirements: 8.1–8.7_

- [ ] **2. Implement `startTui` in kli**
  - [ ] Create `packages/kli/src/start.tui.ts`
  - [ ] Dynamic import `@opentui/core` and `@opentui/solid`
  - [ ] `createCliRenderer({ exitOnCtrlC: true })`
  - [ ] `render(() => App({ deps: cli.deps, opts: resolvedGlobalOpts }), renderer)`
  - [ ] Export (internal — not in public API surface)
  - _Requirements: 8.3–8.6_

- [ ] **3. Create minimal App component in consumer**
  - [ ] Create `/src/shell/tui/app.tui.tsx`
  - [ ] Solid component accepting `{ deps, opts }` props
  - [ ] Render placeholder: app name + entry count + `press ? for help`
  - _Requirements: 8.4_

- [ ] **4. Wire TTY branch in `run`**
  - [ ] Replace TTY stub with real `startTui` call
  - _Requirements: 8.1, 8.2_

- [ ] **5. Register TUI in consumer**
  - [ ] Add `withTui(cli, App)` in `/src/index.ts`
  - _Requirements: 8.3_

- [ ] **6. Checkpoint**
  - [ ] `bun run /src/index.ts` in a real TTY → Solid app renders
  - [ ] `bun run /src/index.ts info` in a TTY → dispatch runs
  - [ ] `echo "" | bun run /src/index.ts` → dispatch runs
  - [ ] `Ctrl+C` exits cleanly with code 0

---

## NOTES

- `*` tasks are optional for MVP
- REQ 7 is explicitly deferred — the consumer app ships a complete, tested
  CLI before a single TUI component is written
- The entire `kli` implementation SHALL stay under 500 lines across all
  source files — if it grows past this, scope is wrong
- No task should take more than 30 minutes — if it does, the scope is wrong
- kli has zero knowledge of any consumer app's types, domain, or flags