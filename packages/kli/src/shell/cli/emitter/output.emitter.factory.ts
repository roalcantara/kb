import type { CliInterceptor, CliInterceptorContext, OptDef, OptsDef } from '@kli/core/cli'
import type { OutputEmitterDefinition, OutputEmitterPackage, OutputEmitterRunContext } from './output.emitter.schema.ts'

/**
 * Builds an emitter package for `shell.setup({ emitter })` or low-level wiring.
 * The returned `interceptor` is outermost: it receives the final return value from `await next()`.
 */
export const createEmitterPackage = <
  DepsT,
  BaseGlobals extends OptsDef,
  ExtraGlobals extends OptsDef = Record<never, OptDef>
>(
  def: OutputEmitterDefinition<DepsT, BaseGlobals, ExtraGlobals>
): OutputEmitterPackage<DepsT, BaseGlobals, ExtraGlobals> => {
  const extraGlobals = (def.globals ?? {}) as ExtraGlobals
  const interceptor: CliInterceptor<CliInterceptorContext<DepsT, BaseGlobals & ExtraGlobals>> = async (ctx, next) => {
    const result = await next()
    await def.run(result, ctx as OutputEmitterRunContext<DepsT, BaseGlobals & ExtraGlobals>)
    return result
  }
  return { globals: extraGlobals, interceptor }
}
