import type { ArgsDef, OptsDef } from './parse_argv.ts'
import type { CliCommand, Middleware } from './with_command.ts'

export type CliInstance<
  DepsT = unknown,
  GlobalsT extends OptsDef = OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef>[] = readonly CliCommand<DepsT, ArgsDef, OptsDef>[]
> = {
  name: string
  version: string
  description: string
  globals: GlobalsT
  deps: DepsT
  middleware: readonly Middleware<unknown>[]
  commands: CommandsT
  tui?: unknown
}

type PackageJsonLike = {
  name?: string
  version?: string
  description?: string
}

type WithCliInput<
  DepsT,
  GlobalsT extends OptsDef = OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef>[] = readonly CliCommand<DepsT, ArgsDef, OptsDef>[]
> = {
  name?: string
  packageJson: PackageJsonLike
  deps: DepsT
  globals?: GlobalsT
  middleware?: readonly Middleware<unknown>[]
  commands: CommandsT
}

export function withCli<
  DepsT,
  GlobalsT extends OptsDef = OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef>[] = readonly CliCommand<DepsT, ArgsDef, OptsDef>[]
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
