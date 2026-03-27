# @kb/kli

Minimal, app-agnostic CLI foundation for Bun.

`@kb/kli` handles only the generic shell concerns:

- argv normalization
- help rendering
- command dispatch and exit code signaling

It intentionally does not know anything about a specific product domain.

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

## API

- `normalizeArgv(rawArgv)` - Normalizes Bun/Node argv into CLI args
- `formatHelp(config)` - Builds help output for the configured CLI
- `runMinimalCli(config, rawArgv)` - Routes command execution and returns exit code

Types:

- `MinimalCliConfig`
- `CliCommandDefinition`

## DESIGN PRINCIPLES

- **Generic by default**: no business/domain logic in the package
- **Small API surface**: only primitives needed to compose real CLIs
- **Predictable behavior**: explicit help, unknown command handling, and exit codes

## DEVELOPMENT

From workspace root:

```sh
bun test packages/kli
bun run typecheck
bun run lint
```

## LICENSE

MIT.
