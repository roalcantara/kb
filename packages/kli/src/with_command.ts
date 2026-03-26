import type { ArgsDef, OptsDef } from './parse_argv.ts'

export type Middleware<CtxT> = (ctx: CtxT, next: () => Promise<void>) => void | Promise<void>

export type CommandHandlerContext<
  ArgsT extends Record<string, unknown> = Record<string, unknown>,
  OptsT extends Record<string, unknown> = Record<string, unknown>,
  DepsT = unknown
> = {
  args: ArgsT
  opts: OptsT
  deps: DepsT
}

export type CliCommand<DepsT = unknown, ArgsT extends ArgsDef = ArgsDef, OptsT extends OptsDef = OptsDef> = {
  name: string
  desc: string
  args?: ArgsT
  opts?: OptsT
  middleware?: readonly Middleware<CommandHandlerContext<Record<string, unknown>, Record<string, unknown>, DepsT>>[]
  run: (ctx: CommandHandlerContext<Record<string, unknown>, Record<string, unknown>, DepsT>) => void | Promise<void>
}

export function withCommand<DepsT = unknown, ArgsT extends ArgsDef = ArgsDef, OptsT extends OptsDef = OptsDef>(
  command: CliCommand<DepsT, ArgsT, OptsT>
): CliCommand<DepsT, ArgsT, OptsT> {
  return command
}
