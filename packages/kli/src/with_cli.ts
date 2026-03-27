import type { ArgsDef, OptsDef } from './parse_argv.ts'
import type { CliCommand, CommandHandlerContext, Middleware, ResolvedOptValues } from './with_command.ts'
import { withCommand } from './with_command.ts'

export type CliInstance<
  DepsT = unknown,
  GlobalsT extends OptsDef = OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[] = readonly CliCommand<
    DepsT,
    ArgsDef,
    OptsDef,
    GlobalsT
  >[]
> = {
  name: string
  version: string
  description: string
  globals: GlobalsT
  deps: DepsT
  middleware: readonly Middleware<
    CommandHandlerContext<Record<string, unknown>, Record<string, unknown>, DepsT, ResolvedOptValues<GlobalsT>>
  >[]
  commands: CommandsT
  tui?: unknown
}

export type PackageJsonLike = {
  name?: string
  version?: string
  description?: string
}

type WithCliInput<
  DepsT,
  GlobalsT extends OptsDef = OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[] = readonly CliCommand<
    DepsT,
    ArgsDef,
    OptsDef,
    GlobalsT
  >[]
> = {
  name?: string
  packageJson: PackageJsonLike
  deps: DepsT
  globals?: GlobalsT
  middleware?: readonly Middleware<
    CommandHandlerContext<Record<string, unknown>, Record<string, unknown>, DepsT, ResolvedOptValues<GlobalsT>>
  >[]
  commands: CommandsT
}

export function withCli<
  DepsT,
  GlobalsT extends OptsDef = OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[] = readonly CliCommand<
    DepsT,
    ArgsDef,
    OptsDef,
    GlobalsT
  >[]
>(input: WithCliInput<DepsT, GlobalsT, CommandsT>): CliInstance<DepsT, GlobalsT, CommandsT> {
  return {
    name: input.name ?? input.packageJson.name ?? 'cli',
    version: input.packageJson.version ?? '0.0.0',
    description: input.packageJson.description ?? 'CLI',
    globals: input.globals ?? ({} as GlobalsT),
    deps: input.deps,
    middleware: input.middleware ?? [],
    commands: input.commands
  }
}

type InitKliInput<DepsT, GlobalsT extends OptsDef> = {
  name?: string
  packageJson: PackageJsonLike
  deps: DepsT
  globals?: GlobalsT
  middleware?: readonly Middleware<
    CommandHandlerContext<Record<string, unknown>, Record<string, unknown>, DepsT, ResolvedOptValues<GlobalsT>>
  >[]
}

export function initKli<DepsT, GlobalsT extends OptsDef = OptsDef>(input: InitKliInput<DepsT, GlobalsT>) {
  const withCmd = <ArgsT extends ArgsDef = ArgsDef, OptsT extends OptsDef = OptsDef>(
    command: CliCommand<DepsT, ArgsT, OptsT, GlobalsT>
  ) => withCommand(command)

  const build = <CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]>(commands: CommandsT) =>
    withCli<DepsT, GlobalsT, CommandsT>({
      ...input,
      commands
    })

  const kli = build([] as const)

  return {
    withCmd,
    build,
    kli
  }
}
