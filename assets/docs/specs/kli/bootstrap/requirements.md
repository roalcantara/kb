<!-- markdownlint-disable-file -->
# KLI

## INTRO

`kli` is a minimal, opinionated CLI micro-framework for Bun/TypeScript.

It exists for one reason: let you build a CLI **today** and grow it into a
full TUI **tomorrow** — without rewriting anything.

It is not general-purpose. It has no plugin system, no registry, no magic.
It is a thin, typed layer over Bun's native argv and OpenTUI's rendering
engine, wired together in the smallest possible surface area.

**Convention over configuration at maximum.** If you need more flexibility
than what is described here, you have outgrown kli.

---

## GLOSSARY

- **`createKli`**: The public entry point. Accepts `packageJson`, deps, globals,
  middleware, interceptors; returns a `KliHandle` with `setup(...)`/`run(...)`.
- **`setup`**: Produces a runner from a command list and optional `emitter`/`tui`.
- **`withCommand`**: Declares a command — name, args, opts, description,
  optional middleware/interceptors, and `run`.
- **`runCommand`**: Executes a built CLI instance. Parses argv, validates, runs
  middleware + interceptor chains, calls the matched command `run`.
- **Global opts**: Options available to every command — declared once in
  `createKli`.
- **Local opts**: Options specific to one command — declared in `withCommand`.
- **Args**: Positional, named, ordered inputs declared per command.
- **`ctx`**: The unified context object every handler and middleware receives.
  Contains `args`, `opts`, `globals`, `deps`, and `raw`.
- **Deps**: Application dependencies — built by the consumer before `withCli`
  is called, passed in as a plain typed object. kli never constructs or owns
  them.
- **Middleware**: An async function `(ctx, next) => Promise<void>` that runs
  before the matched command handler. Can be global or per-command.
- **`either`**: A mutually exclusive option group — multiple short/long flag
  pairs that resolve to a single typed value.
- **`type: 'file'`**: A string flag validated as a file URI path (IANA `file`
  scheme). kli expands `~` and env vars automatically.
- **TTY mode**: `process.stdout.isTTY === true` — `run` mounts the Solid/
  OpenTUI app when no command is given.
- **Pipe mode**: `process.stdout.isTTY === false` — `run` dispatches to the
  matched command and writes plain stdout.

---

## REQUIREMENTS

### REQUIREMENT 0: Project Structure

**User Story:**
As a developer,
I want a Bun workspace with `kli` and my app as separate packages,
so that the framework is cleanly separated from my application code.

#### ACCEPTANCE CRITERIA

1. THE workspace SHALL use Bun workspaces with at minimum two packages: `kli`
   and the consumer app
2. THE workspace SHALL use Bun catalogs to pin shared dev dependency versions
   across all packages
3. THE `kli` package SHALL export its entire public API from one entry point:
   `@kb/kli`
4. THE `kli` package SHALL export testing utilities from a separate entry
   point: `@kb/kli/testing` — never imported in production code
5. THE `kli` package runtime dependencies SHALL be limited to `neverthrow` and
   `radash`; `@opentui/core`, `@opentui/solid`, and `solid-js` SHALL be peer
   dependencies (with `solid-js` optional)
6. THE consumer app SHALL depend on `kli` as a workspace package via
   `"@kb/kli": "workspace:*"`
7. THE workspace root SHALL contain a `mise.toml` with tasks:
   `dev`, `build`, `test`, `lint`, `typecheck`
8. ALL packages SHALL use Bun as runtime, bundler, and test runner
9. ALL packages SHALL use Biome for linting and formatting
10. THE `kli` package SHALL never import from the consumer app
11. THE consumer app SHALL be the only place that imports from both `kli` and
    its own domain code

---

### REQUIREMENT 1: CLI Definition

**User Story:**
As a developer,
I want to declare my entire CLI in one place with a single function call,
so that the relationship between globals, deps, middleware, and commands is
immediately obvious.

#### ACCEPTANCE CRITERIA

1. `createKli(input)` SHALL accept:
   - `packageJson`: `{ name?, version?, description? }` used for help/version
   - `deps`: the consumer's typed dependency object (built externally)
   - `globals`: global opts available to every command (schema)
   - `middleware`: optional array of global middleware functions
   - `interceptors`: optional array of global interceptors (between emitter and
     `command.run`)
   - `name`: optional CLI display name override
2. `createKli` SHALL return a typed handle that can:
   - wrap commands via `withCmd(command)` (type-safe command identity wrapper)
   - build a CLI instance from a **command array**
   - create a runner via `setup({ commands, emitter?, tui?, interceptors? })`
3. `setup({ commands })` SHALL require **at least one command**
4. THE `deps` object SHALL be passed through to every middleware and command
   handler without transformation — kli never constructs, wraps, or stores it
5. `withCli(...)` MAY accept `commands: readonly CliCommand[]` directly as the
   lower-level factory used by `createKli`

---

### REQUIREMENT 2: Command Definition

**User Story:**
As a developer,
I want to declare a command's inputs, description, and handler in one place,
so that there is no distance between the declaration and the logic.

#### ACCEPTANCE CRITERIA

1. `withCommand(definition)` SHALL accept:
   - `name`: command name (subcommand token)
   - `desc`: human-readable description shown in help text
   - `args`: named positional arguments
   - `opts`: command-specific options
   - `middleware`: optional array of command-scoped middleware
   - `interceptors`: optional array of command-scoped interceptors
   - `run`: the async handler function
2. THE handler `run` SHALL receive a single destructured `ctx` object
   containing `{ args, opts, globals, deps, raw }`
3. `args` in `ctx` SHALL be typed according to the command's `args` definition
4. `opts` in `ctx` SHALL be the merge of global opts and command-local opts
   (same keys as the merged schema)
5. `globals` in `ctx` SHALL contain resolved values for **global keys only**
6. `deps` in `ctx` SHALL be the exact typed object passed to `createKli` —
   no wrapping, no transformation
7. `raw` in `ctx` SHALL be the parsed argv object (including tokens and parse
   errors) for escape hatches
7. WHEN a command defines no `args`, `ctx.args` SHALL be an empty object
8. WHEN a command defines no `opts`, `ctx.opts` SHALL contain only global opts

---

### REQUIREMENT 3: Argument Definition

**User Story:**
As a developer,
I want to declare positional arguments by name with types and constraints,
so that handlers receive named, typed values — never raw index-accessed arrays.

#### ACCEPTANCE CRITERIA

1. Arguments SHALL be declared as a record where the key is the argument name
2. THE supported argument definition shape SHALL be:
   ```typescript
   { type: 'string' | 'number' | 'boolean', required?: boolean }
   ```
3. WHEN an argument name ends with `...` (e.g. `'files...'`), it SHALL be
   treated as variadic and produce `string[]` in `ctx.args`
4. WHEN a required argument is absent, `run()` SHALL print a descriptive
   error and exit 1 before middleware or the handler runs
5. Arguments SHALL be parsed in declaration order — first declared = first
   positional token
6. `ctx.args.NAME` SHALL be typed according to the argument's `type` field

---

### REQUIREMENT 4: Option Definition

**User Story:**
As a developer,
I want to declare options with short flags, types, constraints, and defaults
in one place,
so that the relationship between `-c` and `--config` is never ambiguous.

#### ACCEPTANCE CRITERIA

1. Options SHALL be declared as a record where **the key is always the long
   flag name** — e.g. `config` → `--config`
2. THE supported option definition shape SHALL be:
   ```typescript
   {
     short?:   string                    // single character, e.g. 'c'
     type?:    'string' | 'number' | 'boolean' | 'file'
     either?:  Record<string, string>    // mutually exclusive group
     default?: string | number | boolean
     required?: boolean
     desc?:    string
     env?:     string                    // environment variable fallback
   }
   ```
3. WHEN `short` is declared, THEN both `-x` and `--long-name` SHALL be
   accepted as equivalent
4. WHEN `type: 'file'` is declared, THEN the value SHALL be validated as a
   file path — `~` and `$VAR` SHALL be expanded automatically
5. WHEN `env` is declared, THEN the environment variable SHALL be used as
   fallback when the flag is absent from argv
6. WHEN `either` is declared, THEN:
   - Each key in `either` becomes a short flag (e.g. `p` → `-p`)
   - Each value becomes the resolved string value (e.g. `'pretty'`)
   - The long flag name (the option key) is also accepted with a value
   - All flags in the group are mutually exclusive — providing more than one
     SHALL result in a descriptive error and exit 1
   - The resolved type SHALL be the union of all values in `either`
7. WHEN a `required` option is absent and has no `default` and no `env`
   fallback, `run()` SHALL print a descriptive error and exit 1
8. WHEN an option is absent and a `default` is declared, the default SHALL
   be used
9. WHEN the same option appears multiple times in argv (e.g.
   `--tag a --tag b`), the last occurrence SHALL win (multi-value
   accumulation is out-of-scope for this release)
10. Option values SHALL be coerced to the declared `type` — `'500'` →
    `500` for `type: 'number'`, flag presence → `true` for `type: 'boolean'`

---

### REQUIREMENT 5: Middleware

**User Story:**
As a developer,
I want to declare middleware at the global and per-command level,
so that cross-cutting concerns are handled once without touching command
handlers.

#### ACCEPTANCE CRITERIA

1. A middleware function SHALL have the signature:
   `(ctx, next) => Promise<void>`
2. `ctx` in middleware SHALL be the same unified context object the command
   handler receives — same `args`, `opts`, `deps`, `raw`
3. Global middleware SHALL be declared in `withCli` and run for every command
4. Per-command middleware SHALL be declared in `withCommand` and run only for
   that command
5. Middleware SHALL execute in this order:
   global middleware (declaration order) → per-command middleware
   (declaration order) → command handler
6. WHEN middleware does not call `next()`, the remaining chain SHALL NOT run
7. WHEN middleware calls `next()`, execution continues to the next middleware
   or the command handler
8. Errors thrown inside middleware SHALL be caught by `run()`, printed to
   stderr with context, and result in exit 1
9. Middleware SHALL receive fully typed `deps` — the exact object passed to
   `withCli`, unchanged

---

### REQUIREMENT 6: Execution (`run`)

**User Story:**
As a developer,
I want a single `run()` call that handles everything — parsing, validation,
middleware, dispatch, and TTY detection —
so that `index.ts` is as thin as possible.

#### ACCEPTANCE CRITERIA

1. `runCommand(cli)` SHALL execute in this order:
   1. Parse argv into typed args and opts
   2. Detect `--help` / `-h` → `printHelp()` + exit 0
   3. Detect `--version` → print `name version` + exit 0
   4. Detect no command in TTY mode → `startTui()` if TUI is registered
   5. Detect unknown command → stderr + exit 1
   6. Validate required args and opts → stderr per error + exit 1
   7. Validate `either` mutual exclusivity → stderr + exit 1
   8. Run global middleware chain
   9. Run per-command middleware chain
   10. Call command handler with fully built `ctx`
2. `runCommand()` SHALL return an exit code (`0` success / help / version;
   `1` error) without calling `process.exit()`
3. ALL errors from steps 1–10 SHALL be caught, printed to stderr with
   context, and result in exit code `1`
4. `runCommand()` SHALL be async and SHALL be awaited in `index.ts`

---

### REQUIREMENT 7: Help Text

**User Story:**
As a developer,
I want help text generated automatically from my declarations,
so that I never write or maintain it by hand.

#### ACCEPTANCE CRITERIA

1. Help text SHALL be generated entirely from `withCli` and `withCommand`
   definitions — no manually written strings
2. `name`, `version`, and `description` SHALL come from `package.json`
3. THE generated help text SHALL include:
   - App name, version, description
   - `Usage: name <command> [opts]`
   - Commands section: name + desc, aligned
   - Global opts section: short + long + type + desc + default, aligned
4. WHEN `--help` is given after a command name (e.g. `kb info --help`), THEN
   command-specific help SHALL be shown including that command's args and opts
5. Help text format SHALL be fixed — no layout customisation API
6. Help text SHALL be written to stdout

---

### REQUIREMENT 8: TTY / Pipe Mode

**User Story:**
As a developer,
I want the same binary to open a TUI when run interactively and fall back to
plain stdout when piped,
so that humans and scripts both get what they need.

#### ACCEPTANCE CRITERIA

1. WHEN `process.stdout.isTTY` is `true` AND no command is given, THEN
   `run()` SHALL mount the registered Solid component via OpenTUI
2. WHEN `process.stdout.isTTY` is `false` OR a command is given, THEN
   `run()` SHALL dispatch normally — plain stdout only
3. `setup({ tui })` SHALL register the TUI root (opaque) with the CLI instance
4. THE Solid root component SHALL receive `{ deps, globals }` as props —
   `globals` SHALL hold the resolved values for `cli.globals` (global flags only,
   same keys as the global schema)
5. WHEN the user presses `Ctrl+C` in TUI mode, the process SHALL exit
   cleanly with code 0
6. TUI imports (`@opentui/core`, `solid-js`) SHALL be dynamic (`await import`)
   so that pipe mode pays zero TUI startup cost
7. WHEN no TUI is registered (`tui` omitted from setup / `withTui`), TTY mode
   with no command SHALL fall back to `printHelp()` + exit 0

---

### REQUIREMENT 9: Testing Utilities

**User Story:**
As a developer,
I want to test commands and middleware without spawning processes,
so that my tests are fast, pure, and require no filesystem setup.

#### ACCEPTANCE CRITERIA

1. `testCommand(command, ctx)` SHALL call the command handler directly with
   the given `ctx` — no subprocess, no argv parsing
2. `testMiddleware(middleware, ctx)` SHALL call the middleware with the given
   `ctx` and a no-op `next`
3. Both helpers SHALL capture `console.log` → `stdout` and
   `console.error` → `stderr`
4. Both helpers SHALL return `{ stdout, stderr, exitCode }` where
   `exitCode` is `0` on resolve and `1` on throw
5. `testMiddleware` SHALL additionally return `nextCalled: boolean`
6. Console SHALL be fully restored after each call regardless of outcome
7. Both helpers SHALL be exported from `kli/testing` only — never from the
   main `kli` entry point

---

## WHAT KLI IS NOT

- **Not a DI container** — deps are a plain typed object you build and pass in
- **Not a semantic validator** — kli validates flag structure (type, choices,
  required, file URI); semantic validation (is this config file valid? is this
  email real?) belongs in your `buildDeps` using Typia or equivalent
- **Not configurable beyond this document** — if you need more, you have
  outgrown kli