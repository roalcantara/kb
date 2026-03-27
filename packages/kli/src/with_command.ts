import type { ArgsDef, OptDef, OptsDef } from './parse_argv.ts'

export type Middleware<CtxT = unknown> = (ctx: CtxT, next: () => Promise<void>) => void | Promise<void>

type ScalarFromOptDef<DefT extends OptDef> = DefT['type'] extends 'boolean'
  ? boolean
  : DefT['type'] extends 'number'
    ? number
    : string

export type ResolvedOptValues<DefsT extends OptsDef> = {
  [KeyT in keyof DefsT]?: ScalarFromOptDef<DefsT[KeyT]>
}

export type CommandHandlerContext<
  ArgsT extends Record<string, unknown> = Record<string, unknown>,
  OptsT extends Record<string, unknown> = Record<string, unknown>,
  DepsT = unknown,
  GlobalsT extends Record<string, unknown> = Record<string, unknown>
> = {
  args: ArgsT
  opts: OptsT
  globals: GlobalsT
  deps: DepsT
  raw?: unknown
}

export type CliCommand<
  DepsT = unknown,
  ArgsT extends ArgsDef = ArgsDef,
  OptsT extends OptsDef = OptsDef,
  GlobalsT extends OptsDef = OptsDef
> = {
  name: string
  desc: string
  args?: ArgsT
  opts?: OptsT
  middleware?: readonly Middleware<
    CommandHandlerContext<Record<string, unknown>, Record<string, unknown>, DepsT, ResolvedOptValues<GlobalsT>>
  >[]
  run: (
    ctx: CommandHandlerContext<Record<string, unknown>, Record<string, unknown>, DepsT, ResolvedOptValues<GlobalsT>>
  ) => void | Promise<void>
}

export function withCommand<
  DepsT = unknown,
  ArgsT extends ArgsDef = ArgsDef,
  OptsT extends OptsDef = OptsDef,
  GlobalsT extends OptsDef = OptsDef
>(command: CliCommand<DepsT, ArgsT, OptsT, GlobalsT>): CliCommand<DepsT, ArgsT, OptsT, GlobalsT> {
  return command
}
