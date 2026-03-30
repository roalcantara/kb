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
import type { RunCommand } from '../run_command.impl.ts'
import { type CliInstance, withCli } from './cli_instance.factory.ts'

type PackageJsonLike = {
  name?: string
  version?: string
  description?: string
}

/** Assembly input (optional `globals` for empty-schema tests). */
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
  setup: (options: KliSetupOptions<DepsT, GlobalsT>) => SetupRunner
  setupCommands: (...commands: unknown[]) => SetupRunner
  defineEmitter: <Extra extends OptsDef = Record<never, OptDef>>(
    def: CliEmitterDefinition<DepsT, GlobalsT, Extra>
  ) => CliEmitterPackage<DepsT, GlobalsT, Extra>
}

const isArgvPrefix = (x: unknown): x is readonly string[] =>
  Array.isArray(x) && x.length > 0 && x.every((e): e is string => typeof e === 'string')

const assertNonEmptyCommands = (commands: unknown[], message: string): void => {
  if (commands.length === 0) throw new Error(message)
}

const makeRunKliWithCommandList =
  (runCommandImpl: RunCommand) =>
  <const DepsT, const GlobalsT extends OptsDef = NoGlobalOpts>(
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
    return runCommandImpl(cli, rawArgv)
  }

/**
 * Shared {@link KliHandle} builder — pass {@link RunCommand} from {@link ../main.cli.ts} or
 * {@link ../run_command.headless.ts}.
 */
export const buildKliHandle = <const DepsT, const GlobalsT extends OptsDef = NoGlobalOpts>(
  input: KliAssemblyInput<DepsT, GlobalsT>,
  runCommandImpl: RunCommand
): KliHandle<DepsT, GlobalsT> => {
  const runKliWithCommandList = makeRunKliWithCommandList(runCommandImpl)

  const toSetupRunner =
    (
      commands: unknown[],
      setupInterceptors?: readonly CliInterceptor<CliInterceptorContext<DepsT, GlobalsT>>[],
      emitterPackage?: CliEmitterPackage<DepsT, GlobalsT, OptsDef>,
      tui?: unknown
    ): SetupRunner =>
    (rawArgv?: readonly string[]) =>
      runKliWithCommandList(input, rawArgv ?? Bun.argv, commands, setupInterceptors, emitterPackage, tui)

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
    return toSetupRunner(commands, options.interceptors, options.emitter, options.tui)
  }

  const setupCommands = (...commands: unknown[]): SetupRunner => {
    assertNonEmptyCommands(commands, 'shell.setupCommands: pass at least one command')
    return toSetupRunner(commands)
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
