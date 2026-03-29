import type { CliCommand, CliMiddlewareContext, Middleware } from '../../core/commands/command_handler.schema.ts'
import type { ArgsDef, OptsDef } from '../../core/parsing/argv.schema.ts'

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
  middleware: readonly Middleware<CliMiddlewareContext<DepsT, GlobalsT>>[]
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
  middleware?: readonly Middleware<CliMiddlewareContext<DepsT, GlobalsT>>[]
  commands: CommandsT
}

/**
 * Builds a {@link CliInstance} from package metadata, deps, globals schema, middleware, and commands.
 *
 * @param input - `packageJson` supplies default name/version/description; explicit `name` overrides
 * @returns Frozen-shape instance passed to {@link runCommand} and help printers
 *
 * @example
 * withCli({ packageJson: pkg, deps: {}, commands: [cmd] })
 */
export const withCli = <
  DepsT,
  GlobalsT extends OptsDef = OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[] = readonly CliCommand<
    DepsT,
    ArgsDef,
    OptsDef,
    GlobalsT
  >[]
>(
  input: WithCliInput<DepsT, GlobalsT, CommandsT>
): CliInstance<DepsT, GlobalsT, CommandsT> => ({
  name: input.name ?? input.packageJson.name ?? 'cli',
  version: input.packageJson.version ?? '0.0.0',
  description: input.packageJson.description ?? 'CLI',
  globals: input.globals ?? ({} as GlobalsT),
  deps: input.deps,
  middleware: input.middleware ?? [],
  commands: input.commands
})
