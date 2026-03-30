import type { CliInterceptor, CliInterceptorContext, OptsDef } from '@kli/core/cli'

/**
 * Outermost interceptor: prints non-`undefined` handler results with `console.log`.
 * Objects are logged as-is (runtime formatting), not JSON-encoded.
 */
export const defaultEmitterInterceptor: CliInterceptor<
  CliInterceptorContext<Record<string, unknown>, OptsDef>
> = async (_ctx, next) => {
  const result = await next()
  if (result !== undefined) console.log(result)
  return result
}
