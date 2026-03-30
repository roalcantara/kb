# @kb/kli

Minimal, app-agnostic CLI foundation for Bun.

`@kb/kli` handles only the generic shell concerns:

- argv normalization and parsing (flags, positionals, subcommand selection)
- validation of parsed input against command schemas
- help rendering
- command dispatch, middleware, **interceptors** (return-value pipeline), a **default emitter** (`console.log` for handler returns), and exit code signaling

It intentionally does not know anything about a specific product domain.

## Package layout

Source lives under `src/`. The **public API** is intentionally small: see [`src/index.ts`](src/index.ts). Everything else is internal; paths may change between releases.

### `core/` vs `shell/`

| Layer        | Role                                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`core/`**  | Functional CLI mechanics live under **`core/cli/`** (parsing, validation, commands), parallel to **`shell/cli/`**. **Nothing under `core/` may import `shell/`.**              |
| **`shell/`** | Wiring that touches the process: stdout/stderr, `runCommand`, factories (`createKli`, `withCli`), help printers, and test helpers.                                       |

This split keeps domain-free logic testable and keeps I/O and composition at the edges. Dependency rules are enforced for the package (e.g. dependency-cruiser in the repo root).

### Topic folders (nouns)

Folders under `core/` and `shell/` are **topic areas** named with **nouns** (or clear nominalizations), not imperative verbs.

Examples:

- **`core/cli/parsing/`** — From raw argv to structured data: schemas shared with validation, path expansion, argv normalization, and `parseArgv`.
- **`core/cli/validation/`** — Turning a parse result into a validated command context (`validateCommand`, internal cell helpers).
- **`core/cli/commands/`** — Command/handler types (`command_handler.schema.ts`) and the `withCommand` identity helper (`with_command.factory.ts`).
- **`shell/cli/help/`** — Root and per-command help (`printHelp`, `printCommandHelp`): global/local options show optional **`desc`**, and **`either`** groups expand to one line per `-s, --value` choice (with `(default)` on the matching variant).
- **`shell/cli/dispatch/`** — `runCommand` in **`main.cli.ts`**, nested async chain (`nested_async_chain.service.ts`: `runChain`, `runInterceptorChain`).
- **`shell/cli/emitter/`** — Default `console.log` emitter, `createEmitterPackage`, `mergeEmitterGlobals`; optional **`defineEmitter`** + **`setup({ emitter })`** for custom output and extra global flags.
- **`shell/cli/factories/`** — `createKli`, `withCli`.
- **`shell/tui/`** — OpenTUI mount (**`main.tui.ts`**, internal).
- **`shell/cli/testing/`** — Helpers for tests (`testCommand`, `testMiddleware`); imported via `@kb/kli/testing`, not the main entry.

### Middleware vs interceptors vs emitter

- **Middleware** — `(ctx, next) => void`; `next()` has no return value. Runs **around** the whole inner block (emitter + interceptors + `command.run`). Use for timing, logging, guards.
- **Emitter** — Outermost slot only: **`cli.emitterInterceptor`** (default: **`defaultEmitterInterceptor`**) does `await next()` then sinks the return value (default: **`console.log`** when not `undefined`). Replace via **`withCli({ emitterInterceptor })`** or **`shell.setup({ commands, emitter: shell.defineEmitter({ globals?, run }) })`**. Optional **`globals`** on `defineEmitter` merge into the CLI schema for that runner (duplicate keys vs `createKli` globals throw). Put formatting (JSON, YAML, tables) in **`run(output, ctx)`** — not in the core package.
- **Interceptors** — Use **`CliInterceptorContext`**. `(ctx, next) => unknown`; **outermost** first. Chain order: **`[emitter, …createKli/withCli interceptors, …setup interceptors, …command.interceptors]`** — so interceptors run **inside** the emitter and can transform the value before it is sunk. Configure on **`createKli` / `withCli`** (`interceptors`), **`command.interceptors`**, or **`shell.setup({ commands, interceptors })`**. For variadic command lists without an emitter, use **`shell.setupCommands(cmd1, …)`** (typed as `unknown[]` only).

Handlers may return **`undefined`** (side-effect-only); the default emitter then prints nothing.

Vocabulary for CLI input is aligned with common references such as [docopt][2] (commands, options, positional arguments) and [Command Line Interface Guidelines][3] (positional **arguments** vs **flags**). This package’s parsing slice handles **both**, plus **command-name selection** and merged globals—so the folder is not named `args` alone (that would suggest positionals only).

### File naming (suffixes)

Files use suffixes to signal **why** they exist (one main reason to change per file), consistent with the workspace code style guide:

| Suffix           | Typical contents                                                             |
| ---------------- | ---------------------------------------------------------------------------- |
| `*.schema.ts`    | Shared data / command shapes and type-level models                           |
| `*.service.ts`   | Orchestration entry points (`parseArgv`, `validateCommand`, `runCommand`, …) |
| `*.formatter.ts` | Pure string / console-oriented formatting                                    |
| `*.factory.ts`   | Builders (`withCli`, `createKli`, `withCommand`, `createEmitterPackage`)       |
| `*.util.ts`      | Small, focused helpers (e.g. argv normalization, path expansion)             |
| `*.spec.ts`      | Tests co-located next to the unit under test                                 |

Redundant **`cli_` prefixes inside `@kb/kli`** are avoided where the package context is already obvious.

## INSTALL

```sh
bun add @kb/kli
```

## USAGE

Compose a shell handle with **`createKli`**, then **`setup`** commands, optional **`defineEmitter`**, and optional **`tui`** (OpenTUI root). The returned **`runCli`** is your process entry (argv + exit code).

```ts
import { createKli } from '@kb/kli'
import pkg from './package.json'

export const shell = createKli({
  name: 'my-cli',
  packageJson: pkg,
  deps: {},
  globals: {
    verbose: { type: 'boolean', default: false, desc: 'Verbose output' }
  }
})

export const runCli = shell.setup({
  commands: [/* … */],
  // emitter: shell.defineEmitter({ … }),
  // tui: MyTuiRoot,
})
```

Use **`shell.withCmd`** for command definitions (same inference as internal **`withCommand`**).

### Test helpers

```ts
import { testCommand, testMiddleware } from '@kb/kli/testing'
```

## API

The main entry exports only:

- **`createKli`** and **`CreateKliInput`**, **`KliHandle`**, **`KliSetupOptions`**
- Middleware typing: **`Middleware`**, **`CliMiddlewareContext`**, **`OptsDef`**

Deeper modules (`parseArgv`, `runCommand`, `withCommand`, emitters, help printers, …) stay **internal** to the package; they are covered by `@kb/kli`’s own tests. If you need a symbol on the public surface later, add it to [`src/index.ts`](src/index.ts) deliberately.

## DESIGN PRINCIPLES

- **Generic by default**: no business/domain logic in the package
- **Small public API**: internal paths can move; the barrel stays the contract
- **Predictable behavior**: explicit help, unknown command handling, and exit codes
- **Layering**: `core` never depends on `shell`; composition stays in `shell/`

## DEVELOPMENT

From workspace root:

```sh
bun test packages/kli
bun run typecheck
bun run lint
```

## LICENSE

MIT.

[2]: https://docopt.org
[3]: https://clig.dev
