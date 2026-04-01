import type {
  ArgsDef,
  CliCommand,
  CliInterceptor,
  CliInterceptorContext,
  CliMiddlewareContext,
  Middleware,
  OptsDef
} from '@kli/core/cli'
import { outputEmitter } from '../emitter'

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
  /** Global interceptors run before per-command interceptors (outermost first). */
  interceptors: readonly CliInterceptor<CliInterceptorContext<DepsT, GlobalsT>>[]
  /**
   * Outermost: runs `await next()` then sinks the return value (default: `console.log` when not `undefined`).
   */
  emitterInterceptor: CliInterceptor<CliInterceptorContext<DepsT, GlobalsT>>
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
  middleware?: readonly Middleware<CliMiddlewareContext<DepsT, GlobalsT>>[]
  interceptors?: readonly CliInterceptor<CliInterceptorContext<DepsT, GlobalsT>>[]
  /** When set, replaces the default `console.log` emitter (see `defaultEmitterInterceptor`). */
  emitterInterceptor?: CliInterceptor<CliInterceptorContext<DepsT, GlobalsT>>
  commands: CommandsT
  /**
   * Optional TUI root (framework-defined, e.g. Solid component). When omitted, TTY + no subcommand
   * behaves like a plain CLI (root help), regardless of {@link process.stdout.isTTY}.
   */
  tui?: unknown
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
  interceptors: input.interceptors ?? [],
  emitterInterceptor:
    input.emitterInterceptor ?? (outputEmitter as CliInterceptor<CliInterceptorContext<DepsT, GlobalsT>>),
  commands: input.commands,
  ...(input.tui === undefined ? {} : { tui: input.tui })
})
