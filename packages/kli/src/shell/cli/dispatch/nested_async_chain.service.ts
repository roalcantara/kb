import type { CliInterceptor, Middleware } from '@kli/core/cli'

type NestedAsyncLink<CtxT, R> = (ctx: CtxT, next: () => Promise<R>) => R | Promise<R>

type OnUndefinedLink = 'invoke-leaf' | 'abort-without-leaf'

/**
 * Nest-style async onion: outer `links[0]` runs first; each `next()` continues toward `leaf`.
 *
 * @param onUndefinedLink - **`invoke-leaf`** (interceptor semantics): missing entry runs `leaf` and skips deeper links at this frame. **`abort-without-leaf`** (middleware semantics): missing entry ends the chain without running `leaf`.
 */
const runNestedAsyncChainImpl = async <CtxT, R>(
  links: readonly NestedAsyncLink<CtxT, R>[],
  ctx: CtxT,
  leaf: () => R | Promise<R>,
  index: number,
  onUndefinedLink: OnUndefinedLink
): Promise<R> => {
  if (index >= links.length) {
    return await leaf()
  }

  const link = links[index]
  if (!link) {
    if (onUndefinedLink === 'abort-without-leaf') {
      return undefined as R
    }
    return await leaf()
  }

  return await link(ctx, async () => runNestedAsyncChainImpl(links, ctx, leaf, index + 1, onUndefinedLink))
}

/**
 * Runs middleware in order; each may call `next()` to continue toward `handler`.
 * A **missing** array entry aborts the chain without running `handler`.
 */
export const runChain = async <CtxT>(
  middlewares: readonly Middleware<CtxT>[],
  ctx: CtxT,
  handler: () => Promise<void>
): Promise<void> => {
  await runNestedAsyncChainImpl<CtxT, void>(
    middlewares as readonly NestedAsyncLink<CtxT, void>[],
    ctx,
    handler,
    0,
    'abort-without-leaf'
  )
}

/**
 * Runs interceptors outermost-first; innermost invokes `handler`. Return values propagate outward.
 * A **missing** array entry runs `handler` immediately (same as previous `runInterceptorChain`).
 */
export const runInterceptorChain = async <CtxT>(
  interceptors: readonly CliInterceptor<CtxT>[],
  ctx: CtxT,
  handler: () => unknown | Promise<unknown>
): Promise<unknown> =>
  runNestedAsyncChainImpl<CtxT, unknown>(
    interceptors as readonly NestedAsyncLink<CtxT, unknown>[],
    ctx,
    handler,
    0,
    'invoke-leaf'
  )
