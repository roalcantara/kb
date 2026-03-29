import type { OptsDef } from '../parsing/argv.schema.ts'
import type { CliInterceptor, CliInterceptorContext } from './command_handler.schema.ts'

/**
 * Identity helper that preserves inferred interceptor typing (same idea as {@link withCommand}).
 *
 * @example
 * export const redactInterceptor = shell.withInterceptor(async (ctx, next) => {
 *   const value = await next()
 *   return value
 * })
 */
export const withInterceptor = <I extends CliInterceptor<CliInterceptorContext<unknown, OptsDef>>>(interceptor: I): I =>
  interceptor
