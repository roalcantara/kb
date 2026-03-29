import type { ArgsDef, OptDef, OptsDef } from '../parsing/argv.schema.ts'
import type { CliCommand } from './command_handler.schema.ts'

/** Default when a command has no CLI-wide schema; avoids inferring `GlobalsT` as open `OptsDef`. */
type EmptyGlobalOptsDef = Record<never, OptDef>

/**
 * Identity helper that preserves inferred `CliCommand` generics (deps, args, opts, globals).
 *
 * @param command - Command definition returned as-is for ergonomic inference at callsites
 * @returns The same `command` reference
 *
 * @example
 * const cmd = withCommand({
 *   name: 'info',
 *   desc: 'Show info',
 *   run: ({ deps }) => { deps }
 * })
 */
export const withCommand = <
  DepsT = unknown,
  ArgsT extends ArgsDef = ArgsDef,
  OptsT extends OptsDef = OptsDef,
  GlobalsT extends OptsDef = EmptyGlobalOptsDef
>(
  command: CliCommand<DepsT, ArgsT, OptsT, GlobalsT>
): CliCommand<DepsT, ArgsT, OptsT, GlobalsT> => command
