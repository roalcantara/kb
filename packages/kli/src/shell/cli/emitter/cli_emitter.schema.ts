import type {
  CliInterceptor,
  CliInterceptorContext,
  CliMiddlewareContext,
  OptsDef,
  ResolvedGlobalsMap
} from '@kli/core/cli'

/**
 * Context for {@link CliEmitterDefinition.run}: wide `args` / `opts` (heterogeneous commands),
 * **`globals` from {@link ResolvedGlobalsMap}** of base + emitter schema.
 */
export type CliEmitterRunContext<DepsT, MergedGlobals extends OptsDef> = Pick<
  CliMiddlewareContext<DepsT, OptsDef>,
  'deps' | 'args' | 'opts'
> & {
  globals: ResolvedGlobalsMap<MergedGlobals>
  raw?: unknown
}

/**
 * User-defined handler for printing (or otherwise sinking) the value returned from
 * `command.run`. Runs as the outermost interceptor: `await next()` yields the handler result
 * (after inner interceptors transform it).
 */
export type CliEmitterDefinition<DepsT, BaseGlobals extends OptsDef, ExtraGlobals extends OptsDef> = {
  /** Extra global flags merged into the CLI schema for this `setup` runner (duplicate keys vs `createKli` globals throw). */
  globals?: ExtraGlobals
  run: (output: unknown, ctx: CliEmitterRunContext<DepsT, BaseGlobals & ExtraGlobals>) => void | Promise<void>
}

/** Return value of {@link createEmitterPackage} / `shell.defineEmitter` for `setup({ emitter })`. */
export type CliEmitterPackage<DepsT, BaseGlobals extends OptsDef, ExtraGlobals extends OptsDef> = {
  globals: ExtraGlobals
  interceptor: CliInterceptor<CliInterceptorContext<DepsT, BaseGlobals & ExtraGlobals>>
}

/** Merge CLI globals with emitter globals; throws if a key exists in both. */
export const mergeEmitterGlobals = <Base extends OptsDef, Extra extends OptsDef>(
  base: Base,
  extra: Extra
): Base & Extra => {
  for (const k of Object.keys(extra)) {
    if (k in base) {
      throw new Error(`Emitter global "${k}" conflicts with existing CLI globals`)
    }
  }
  return { ...base, ...extra } as Base & Extra
}
