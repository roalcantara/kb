import type { CliCommand, CliMiddlewareContext, Middleware } from '../../core/commands/command_handler.schema.ts'
import { withCommand } from '../../core/commands/with_command.factory.ts'
import type { ArgsDef, OptDef, OptsDef } from '../../core/parsing/argv.schema.ts'
import { runCommand } from '../dispatch/run_command.service.ts'
import type { CliInstance } from './cli_instance.factory.ts'
import { withCli } from './cli_instance.factory.ts'

type PackageJsonLike = {
  name?: string
  version?: string
  description?: string
}

/** Assembly input (optional `globals` for tests with an empty schema). */
type KliAssemblyInput<DepsT, GlobalsT extends OptsDef> = {
  name?: string
  packageJson: PackageJsonLike
  deps: DepsT
  globals?: GlobalsT
  middleware?: readonly Middleware<CliMiddlewareContext<DepsT, GlobalsT>>[]
}

export type CreateKliInput<
  DepsT extends Record<string, unknown> = Record<string, unknown>,
  GlobalsT extends OptsDef = OptsDef
> = {
  /** Omit key instead of passing `undefined` (`exactOptionalPropertyTypes`). */
  name?: NoInfer<string>
  packageJson: NoInfer<PackageJsonLike>
  deps: DepsT
  globals: GlobalsT
  middleware?: NoInfer<readonly Middleware<CliMiddlewareContext<DepsT, GlobalsT>>[]>
}

type NoGlobalOpts = Record<never, OptDef>

export type KliHandle<DepsT, GlobalsT extends OptsDef> = {
  withCmd: <ArgsT extends ArgsDef = ArgsDef, OptsT extends OptsDef = OptsDef>(
    command: CliCommand<DepsT, ArgsT, OptsT, GlobalsT>
  ) => CliCommand<DepsT, ArgsT, OptsT, GlobalsT>
  build: <CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]>(
    commands: CommandsT
  ) => CliInstance<DepsT, GlobalsT, CommandsT>
  kli: CliInstance<DepsT, GlobalsT, readonly []>
  run: (...args: unknown[]) => Promise<number>
  setup: (...commands: unknown[]) => (rawArgv?: readonly string[]) => Promise<number>
}

/** True when `x` is a non-empty `string[]` (used to detect `run([...argv], ...cmds)` overload). */
const isArgvPrefix = (x: unknown): x is readonly string[] =>
  Array.isArray(x) && x.length > 0 && x.every((e): e is string => typeof e === 'string')

/**
 * Implements {@link KliHandle}: `withCmd`, `build`, `kli`, `run`, and `setup` over one assembly input.
 *
 * @param input - Same shape as {@link createKli} (optional `globals` for empty-schema tests)
 */
const buildKliHandle = <const DepsT, const GlobalsT extends OptsDef = NoGlobalOpts>(
  input: KliAssemblyInput<DepsT, GlobalsT>
): KliHandle<DepsT, GlobalsT> => {
  const withCmd = <ArgsT extends ArgsDef = ArgsDef, OptsT extends OptsDef = OptsDef>(
    command: CliCommand<DepsT, ArgsT, OptsT, GlobalsT>
  ) => withCommand(command)

  const build = <CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]>(commands: CommandsT) =>
    withCli<DepsT, GlobalsT, CommandsT>({ ...input, commands })

  const kli = build([] as const)

  const runWithCommands = (rawArgv: readonly string[], commands: unknown[]): Promise<number> => {
    if (commands.length === 0) {
      throw new Error('shell.run: pass at least one command')
    }
    const cli = withCli<DepsT, GlobalsT, readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]>({
      ...input,
      commands: commands as readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]
    })
    return runCommand(cli, rawArgv)
  }

  const run = (...args: unknown[]): Promise<number> => {
    let rawArgv: readonly string[]
    let commands: unknown[]
    if (args.length > 0 && isArgvPrefix(args[0])) {
      rawArgv = args[0]
      commands = args.slice(1)
    } else {
      rawArgv = Bun.argv
      commands = args
    }
    return runWithCommands(rawArgv, commands)
  }

  const setup = (...commands: unknown[]): ((rawArgv?: readonly string[]) => Promise<number>) => {
    if (commands.length === 0) {
      throw new Error('shell.setup: pass at least one command')
    }
    return (rawArgv?: readonly string[]) => runWithCommands(rawArgv ?? Bun.argv, commands)
  }

  return {
    withCmd,
    build,
    kli,
    run,
    setup
  }
}

/**
 * Creates a strongly-typed command-line interface (CLI) definition and handler.
 *
 * This function is the core entry point for building a CLI using typed command, option,
 * and global spec definitions. It takes a configuration object specifying dependencies,
 * global options, CLI name, middleware, and metadata, and returns a handle to build,
 * extend, and run the CLI.
 *
 * @template DepsT - The type of dependency injection object available to all commands.
 * @template GlobalsT - The global options type (all CLI handlers receive these).
 *
 * @param input - Configuration object containing:
 *   - `name`: The CLI name (string, required, e.g. "kb")
 *   - `packageJson`: Package metadata, used for version/help output
 *   - `deps`: Object containing injected dependencies available to all commands
 *   - `globals`: Definition of global CLI flags/options (type-safe)
 *   - `middleware`: (Optional) Array of middleware applied to all commands
 *
 * @returns KliHandle - An object with helpers for defining commands (`withCmd`),
 *   building a typed CLI (`build`), and running the CLI (`run`, `setup`).
 *
 * @example
 * ```ts
 * import { createKli } from '@kb/kli'
 *
 * const shell = createKli({
 *   name: 'kb',
 *   packageJson: pkg,
 *   deps: { greeter },
 *   globals: {
 *     verbose: { type: 'boolean', default: false },
 *     debug: { type: 'boolean', default: false }
 *   },
 *   middleware: [timingMiddleware]
 * })
 *
 * shell.withCmd({
 *   name: 'hello',
 *   desc: 'Prints hello',
 *   args: {},
 *   opts: {},
 *   run: ({ deps, globals }) => { ... }
 * })
 * ```
 */
export const createKli = <const DepsT extends Record<string, unknown>, const GlobalsT extends OptsDef>(
  input: CreateKliInput<DepsT, GlobalsT>
): KliHandle<DepsT, GlobalsT> => buildKliHandle(input)
