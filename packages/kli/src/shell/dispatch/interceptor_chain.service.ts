import type { CliInterceptor } from '../../core/commands/command_handler.schema.ts'

/**
 * Runs interceptors outermost-first; the innermost invokes `handler`. Each interceptor
 * receives the value returned by `await next()` (handler or inner interceptors).
 *
 * Mirrors Nest-style interceptors: the first entry wraps the rest of the chain.
 */
export const runInterceptorChain = async <CtxT>(
  interceptors: readonly CliInterceptor<CtxT>[],
  ctx: CtxT,
  handler: () => unknown | Promise<unknown>,
  index = 0
): Promise<unknown> => {
  if (index >= interceptors.length) {
    return await handler()
  }

  const interceptor = interceptors[index]
  if (!interceptor) {
    return await handler()
  }

  return await interceptor(ctx, async () => runInterceptorChain(interceptors, ctx, handler, index + 1))
}
