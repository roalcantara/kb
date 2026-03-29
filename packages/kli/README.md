# @kb/kli

Minimal, app-agnostic CLI foundation for Bun.

`@kb/kli` handles only the generic shell concerns:

- argv normalization and parsing (flags, positionals, subcommand selection)
- validation of parsed input against command schemas
- help rendering
- command dispatch, middleware, and exit code signaling

It intentionally does not know anything about a specific product domain.

## Package layout

Source lives under `src/`. The **public API** is exported only from [`src/index.ts`](src/index.ts). Internal module paths may change between releases; depend on the barrel unless you accept coupling to internals.

### `core/` vs `shell/`

| Layer        | Role                                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`core/`**  | Pure mechanics: parsing tokens, validating against defs, types for handlers, and the optional minimal multi-command runner. **Nothing under `core/` may import `shell/`.** |
| **`shell/`** | Wiring that touches the process: stdout/stderr, `runCommand`, factories (`createKli`, `withCli`), help printers, and test helpers.                                         |

This split keeps domain-free logic testable and keeps I/O and composition at the edges. Dependency rules are enforced for the package (e.g. dependency-cruiser in the repo root).

### Topic folders (nouns)

Folders under `core/` and `shell/` are **topic areas** named with **nouns** (or clear nominalizations), not imperative verbs—so you can see “everything for this concern” in one place.

Examples:

- **`core/parsing/`** — From raw argv to structured data: schemas shared with validation, path expansion, argv normalization, and `parseArgv`. The name **parsing** is the umbrella; filenames still say **argv** where they mirror `Bun.argv` / `parseArgv` (Unix-accurate, familiar to Bun users).
- **`core/validation/`** — Turning a parse result into a validated command context (`validateCommand`, internal cell helpers).
- **`core/commands/`** — Command/handler types (`command_handler.schema.ts`) and the `withCommand` identity helper (`with_command.factory.ts`).
- **`core/minimal/`** — Small standalone multi-command runner (`runMinimalCli`, `formatHelp`) for apps that do not use the full `createKli` stack.
- **`shell/help/`** — Help/version text sent to the console.
- **`shell/dispatch/`** — `runCommand`, middleware chain execution.
- **`shell/factories/`** — `createKli`, `withCli`, TUI attachment helper.
- **`shell/testing/`** — Helpers for tests (`testCommand`, `testMiddleware`); imported via `@kb/kli/testing`, not the main entry.

Vocabulary for CLI input is aligned with common references such as [docopt][2] (commands, options, positional arguments) and [Command Line Interface Guidelines][3] (positional **arguments** vs **flags**). This package’s parsing slice handles **both**, plus **command-name selection** and merged globals—so the folder is not named `args` alone (that would suggest positionals only).

### File naming (suffixes)

Files use suffixes to signal **why** they exist (one main reason to change per file), consistent with the workspace code style guide:

| Suffix           | Typical contents                                                             |
| ---------------- | ---------------------------------------------------------------------------- |
| `*.schema.ts`    | Shared data / command shapes and type-level models                           |
| `*.service.ts`   | Orchestration entry points (`parseArgv`, `validateCommand`, `runCommand`, …) |
| `*.formatter.ts` | Pure string / console-oriented formatting                                    |
| `*.factory.ts`   | Builders that assemble instances (`withCli`, `createKli`, `withCommand`)     |
| `*.util.ts`      | Small, focused helpers (e.g. argv normalization, path expansion)             |
| `*.spec.ts`      | Tests co-located next to the unit under test                                 |

Redundant **`cli_` prefixes inside `@kb/kli`** are avoided where the package context is already obvious; **`minimal_cli_*`** is kept for the small runner family so it stays distinct from the full KLI stack.

## INSTALL

```sh
bun add @kb/kli
```

## USAGE

```ts
import { runMinimalCli, type MinimalCliConfig } from '@kb/kli'

const cli: MinimalCliConfig = {
  programName: 'my-cli',
  description: 'My CLI',
  version: '0.1.0',
  commands: [
    {
      name: 'greet',
      helpLine: 'greet [name]   Greet someone',
      run: args => {
        console.log(`Hello ${args[0] ?? 'World'}!`)
      }
    }
  ]
}

const code = runMinimalCli(cli, Bun.argv)
if (code !== 0) process.exitCode = code
```

For typed commands, globals, middleware, and `runCommand`, use `createKli`, `withCli`, and related exports from the main barrel.

### Test helpers

```ts
import { testCommand, testMiddleware } from '@kb/kli/testing'
```

## API

The barrel re-exports the stable surface, including:

- **Argv / parse**: `normalizeArgv`, `parseArgv`, and schema types (`CommandDef`, `OptsDef`, `ParseResult`, …)
- **Validation**: `validateCommand`, `ResolvedCtxData`
- **Handlers**: `withCommand`, `CliCommand`, middleware types, …
- **Minimal runner**: `runMinimalCli`, `formatHelp`, `MinimalCliConfig`, `CliCommandDefinition`
- **Full stack**: `createKli`, `runCommand`, `withCli`, help printers, `withTui`

See [`src/index.ts`](src/index.ts) for the authoritative list.

## DESIGN PRINCIPLES

- **Generic by default**: no business/domain logic in the package
- **Small, stable public API**: internal paths can move; the barrel stays the contract
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