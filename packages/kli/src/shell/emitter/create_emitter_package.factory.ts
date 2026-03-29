import type { CliInterceptor, CliInterceptorContext } from '../../core/commands/command_handler.schema.ts'
import type { OptDef, OptsDef } from '../../core/parsing/argv.schema.ts'
import type { CliEmitterDefinition, CliEmitterPackage, CliEmitterRunContext } from './cli_emitter.schema.ts'

/**
 * Builds an emitter package for `shell.setup({ emitter })` or low-level wiring.
 * The returned `interceptor` is outermost: it receives the final return value from `await next()`.
 */
export const createEmitterPackage = <
  DepsT,
  BaseGlobals extends OptsDef,
  ExtraGlobals extends OptsDef = Record<never, OptDef>
>(
  def: CliEmitterDefinition<DepsT, BaseGlobals, ExtraGlobals>
): CliEmitterPackage<DepsT, BaseGlobals, ExtraGlobals> => {
  const extraGlobals = (def.globals ?? {}) as ExtraGlobals
  const interceptor: CliInterceptor<CliInterceptorContext<DepsT, BaseGlobals & ExtraGlobals>> = async (ctx, next) => {
    const result = await next()
    await def.run(result, ctx as CliEmitterRunContext<DepsT, BaseGlobals & ExtraGlobals>)
    return result
  }
  return { globals: extraGlobals, interceptor }
}
