import type { Middleware } from '../../core/commands/command_handler.schema.ts'

/**
 * Runs middleware in order; each may call `next()` to continue toward `handler`.
 *
 * @param middlewares - Global then command middleware (caller merges)
 * @param ctx - Context passed to each middleware and the handler
 * @param handler - Final command `run` invocation
 * @param index - Internal recursion index
 */
export const runChain = async <CtxT>(
  middlewares: readonly Middleware<CtxT>[],
  ctx: CtxT,
  handler: () => Promise<void>,
  index = 0
): Promise<void> => {
  if (index >= middlewares.length) {
    await handler()
    return
  }

  const middleware = middlewares[index]
  if (!middleware) return

  await middleware(ctx, async () => {
    // Short-circuit is automatic when middleware omits next().
    await runChain(middlewares, ctx, handler, index + 1)
  })
}
