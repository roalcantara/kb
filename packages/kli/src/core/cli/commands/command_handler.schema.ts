import type { ArgDef, ArgsDef, OptDef, OptsDef } from '../parsing/index.ts'

/** Default when a command has no CLI-wide schema; avoids inferring `GlobalsT` as open `OptsDef`. */
type EmptyGlobalOptsDef = Record<never, OptDef>

export type Middleware<CtxT = unknown> = (ctx: CtxT, next: () => Promise<void>) => void | Promise<void>

/**
 * Wraps command execution and the returned value (Nest-style interceptors). `next` runs
 * deeper interceptors, then `command.run`; return its result or a transformed value.
 */
export type CliInterceptor<CtxT = unknown> = (ctx: CtxT, next: () => Promise<unknown>) => unknown | Promise<unknown>

type ScalarFromOptDef<DefT extends OptDef | ArgDef> = DefT['type'] extends 'boolean'
  ? boolean
  : DefT['type'] extends 'number'
    ? number
    : string

/** Args with `required: false` stay unset only when there is no `default` (runtime fills default before `run`). */
type ArgValueForDef<D extends ArgDef> = D extends { required: false }
  ? D extends { default: infer DefaultV }
    ? DefaultV extends string | number | boolean
      ? ScalarFromOptDef<D>
      : ScalarFromOptDef<D> | undefined
    : ScalarFromOptDef<D> | undefined
  : ScalarFromOptDef<D>

type VariadicArgValue<D extends ArgDef> = D extends { required: false }
  ? D extends { default: infer DefaultV }
    ? DefaultV extends string | number | boolean
      ? ScalarFromOptDef<D>[]
      : ScalarFromOptDef<D>[] | undefined
    : ScalarFromOptDef<D>[] | undefined
  : ScalarFromOptDef<D>[]

/** Like args: optional opts without `default` may be unset; with `default`, runtime always fills before `run`. */
type OptValueForDef<D extends OptDef> = D extends { required: true }
  ? ScalarFromOptDef<D>
  : D extends { default: infer DefaultV }
    ? DefaultV extends string | number | boolean
      ? ScalarFromOptDef<D>
      : ScalarFromOptDef<D> | undefined
    : ScalarFromOptDef<D> | undefined

export type ResolvedArgsMap<DefsT extends ArgsDef> = {
  [KeyT in keyof DefsT as KeyT extends `${infer BaseT}...` ? BaseT : KeyT]: KeyT extends `${string}...`
    ? VariadicArgValue<DefsT[KeyT]>
    : ArgValueForDef<DefsT[KeyT]>
}

export type ResolvedLocalOptsMap<LocalT extends OptsDef> = {
  [K in keyof LocalT]: OptValueForDef<LocalT[K]>
}

export type ResolvedGlobalsMap<GlobalsT extends OptsDef> = {
  [K in keyof GlobalsT]: OptValueForDef<GlobalsT[K]>
}

export type CommandHandlerContext<
  ArgsT extends Record<string, unknown> = Record<string, unknown>,
  OptsT extends Record<string, unknown> = Record<string, unknown>,
  DepsT = unknown,
  GlobalsMapT extends Record<string, unknown> = Record<string, never>
> = {
  args: ArgsT
  opts: OptsT
  globals: GlobalsMapT
  deps: DepsT
  raw?: unknown
}

export type RunHandlerContext<
  DepsT,
  ArgsT extends ArgsDef,
  OptsT extends OptsDef,
  GlobalsT extends OptsDef
> = CommandHandlerContext<ResolvedArgsMap<ArgsT>, ResolvedLocalOptsMap<OptsT>, DepsT, ResolvedGlobalsMap<GlobalsT>>

type RunScalar = string | number | boolean

/** Wider ctx for middleware so heterogeneous `commands` arrays type-check. */
export type CliMiddlewareContext<DepsT, _GlobalsT extends OptsDef = OptsDef> = CommandHandlerContext<
  Record<string, RunScalar | RunScalar[] | undefined>,
  Record<string, RunScalar | undefined>,
  DepsT,
  Record<string, RunScalar | undefined>
>

/**
 * Context for interceptors — same fields as {@link CliMiddlewareContext}; distinct name so
 * interceptors are not confused with middleware-only usage.
 */
export type CliInterceptorContext<DepsT, GlobalsT extends OptsDef = OptsDef> = CliMiddlewareContext<DepsT, GlobalsT>

export type CliCommand<
  DepsT = unknown,
  ArgsT extends ArgsDef = ArgsDef,
  OptsT extends OptsDef = OptsDef,
  GlobalsT extends OptsDef = EmptyGlobalOptsDef
> = {
  name: string
  desc: string
  args?: ArgsT
  opts?: OptsT
  middleware?: readonly Middleware<CliMiddlewareContext<DepsT, GlobalsT>>[]
  /** Per-command interceptors run after global interceptors (closer to `run`). */
  interceptors?: readonly CliInterceptor<CliInterceptorContext<DepsT, GlobalsT>>[]
  /**
   * Return structured data for global interceptors (e.g. formatters). `void` / `undefined`
   * skips post-handling output from those interceptors.
   */
  run: (ctx: RunHandlerContext<DepsT, ArgsT, OptsT, GlobalsT>) => void | Promise<void> | unknown | Promise<unknown>
}
