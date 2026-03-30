import {
  type ArgsDef,
  type CliCommand,
  type CliInterceptor,
  type CliInterceptorContext,
  type CliMiddlewareContext,
  type Middleware,
  type OptDef,
  type OptsDef,
  withCommand
} from '@kli/core/cli'
import {
  type CliEmitterDefinition,
  type CliEmitterPackage,
  createEmitterPackage,
  mergeEmitterGlobals
} from '../emitter'
import { runCommand } from '../main.cli.ts'
import { type CliInstance, withCli } from './cli_instance.factory.ts'

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
  interceptors?: readonly CliInterceptor<CliInterceptorContext<DepsT, GlobalsT>>[]
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
  interceptors?: NoInfer<readonly CliInterceptor<CliInterceptorContext<DepsT, GlobalsT>>[]>
}

type NoGlobalOpts = Record<never, OptDef>

type SetupRunner = (rawArgv?: readonly string[]) => Promise<number>

/** Options for {@link KliHandle.setup} (typed object form; supports `emitter`). */
export type KliSetupOptions<DepsT, GlobalsT extends OptsDef> = {
  commands: readonly unknown[]
  interceptors?: readonly CliInterceptor<CliInterceptorContext<DepsT, GlobalsT>>[]
  emitter?: CliEmitterPackage<DepsT, GlobalsT, OptsDef>
  /**
   * TUI root (opaque). If omitted, the runner never takes the TUI path: TTY + no subcommand shows
   * root help like a normal CLI.
   */
  tui?: unknown
}

export type KliHandle<DepsT, GlobalsT extends OptsDef> = {
  withCmd: <ArgsT extends ArgsDef = ArgsDef, OptsT extends OptsDef = OptsDef>(
    command: CliCommand<DepsT, ArgsT, OptsT, GlobalsT>
  ) => CliCommand<DepsT, ArgsT, OptsT, GlobalsT>
  build: <CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]>(
    commands: CommandsT
  ) => CliInstance<DepsT, GlobalsT, CommandsT>
  kli: CliInstance<DepsT, GlobalsT, readonly []>
  run: (...args: unknown[]) => Promise<number>
  /**
   * Object form only (so `emitter` and `interceptors` are type-checked). For `setup(cmd1, cmd2)` use
   * {@link setupCommands}.
   */
  setup: (options: KliSetupOptions<DepsT, GlobalsT>) => SetupRunner
  /** Variadic shorthand: `setupCommands(a, b)` ≡ `setup({ commands: [a, b] })` (no `emitter`). */
  setupCommands: (...commands: unknown[]) => SetupRunner
  defineEmitter: <Extra extends OptsDef = Record<never, OptDef>>(
    def: CliEmitterDefinition<DepsT, GlobalsT, Extra>
  ) => CliEmitterPackage<DepsT, GlobalsT, Extra>
}

/** True when `x` is a non-empty `string[]` (used to detect `run([...argv], ...cmds)` overload). */
const isArgvPrefix = (x: unknown): x is readonly string[] =>
  Array.isArray(x) && x.length > 0 && x.every((e): e is string => typeof e === 'string')

const assertNonEmptyCommands = (commands: unknown[], message: string): void => {
  if (commands.length === 0) throw new Error(message)
}

const runKliWithCommandList = <const DepsT, const GlobalsT extends OptsDef = NoGlobalOpts>(
  input: KliAssemblyInput<DepsT, GlobalsT>,
  rawArgv: readonly string[],
  commands: unknown[],
  setupInterceptors?: readonly CliInterceptor<CliInterceptorContext<DepsT, GlobalsT>>[],
  emitterPackage?: CliEmitterPackage<DepsT, GlobalsT, OptsDef>,
  tui?: unknown
): Promise<number> => {
  assertNonEmptyCommands(commands, 'shell.run: pass at least one command')
  const baseGlobals = (input.globals ?? {}) as OptsDef
  const mergedGlobals = emitterPackage
    ? mergeEmitterGlobals(baseGlobals, emitterPackage.globals as OptsDef)
    : baseGlobals
  const emitterInterceptor = emitterPackage
    ? (emitterPackage.interceptor as CliInterceptor<CliInterceptorContext<DepsT, GlobalsT>>)
    : undefined
  const cli = withCli<DepsT, GlobalsT, readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]>({
    ...input,
    globals: mergedGlobals as GlobalsT,
    commands: commands as readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[],
    interceptors: [...(input.interceptors ?? []), ...(setupInterceptors ?? [])],
    ...(emitterInterceptor === undefined ? {} : { emitterInterceptor }),
    ...(tui === undefined ? {} : { tui })
  })
  return runCommand(cli, rawArgv)
}

const toSetupRunner =
  <const DepsT, const GlobalsT extends OptsDef = NoGlobalOpts>(
    input: KliAssemblyInput<DepsT, GlobalsT>,
    commands: unknown[],
    setupInterceptors?: readonly CliInterceptor<CliInterceptorContext<DepsT, GlobalsT>>[],
    emitterPackage?: CliEmitterPackage<DepsT, GlobalsT, OptsDef>,
    tui?: unknown
  ): SetupRunner =>
  (rawArgv?: readonly string[]) =>
    runKliWithCommandList(input, rawArgv ?? Bun.argv, commands, setupInterceptors, emitterPackage, tui)

/**
 * Implements {@link KliHandle}: `withCmd`, `build`, `kli`, `run`, `setup`, `setupCommands`, `defineEmitter`.
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

  const defineEmitter = <Extra extends OptsDef = Record<never, OptDef>>(
    def: CliEmitterDefinition<DepsT, GlobalsT, Extra>
  ) => createEmitterPackage<DepsT, GlobalsT, Extra>(def)

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
    return runKliWithCommandList(input, rawArgv, commands)
  }

  const setup = (options: KliSetupOptions<DepsT, GlobalsT>): SetupRunner => {
    const commands = [...options.commands]
    assertNonEmptyCommands(commands, 'shell.setup: pass at least one command')
    return toSetupRunner(input, commands, options.interceptors, options.emitter, options.tui)
  }

  const setupCommands = (...commands: unknown[]): SetupRunner => {
    assertNonEmptyCommands(commands, 'shell.setupCommands: pass at least one command')
    return toSetupRunner(input, commands)
  }

  return {
    withCmd,
    build,
    kli,
    run,
    setup,
    setupCommands,
    defineEmitter
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
 *   - `interceptors`: (Optional) Interceptors between the default emitter and `command.run` (see README)
 *
 * @returns KliHandle - Helpers: `withCmd`, `build`, `run`, typed `setup({ commands, emitter? })`,
 *   variadic `setupCommands(...)`, and `defineEmitter`.
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
