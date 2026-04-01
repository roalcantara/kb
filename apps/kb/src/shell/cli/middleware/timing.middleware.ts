import type { CliMiddlewareContext, Middleware, OptsDef } from '@kb/kli'

const NANOSECONDS_PER_MILLISECOND = 1_000_000

/** `DepsT` is unknown so this matches any `createKli` deps without a shared `deps.ts`. */
export const timingMiddleware: Middleware<CliMiddlewareContext<unknown, OptsDef>> = async (ctx, next) => {
  const startedAt = process.hrtime.bigint()
  await next()

  const elapsedNs = process.hrtime.bigint() - startedAt
  const elapsedMs = Number(elapsedNs) / NANOSECONDS_PER_MILLISECOND
  const commandName = (ctx.raw as { commandName?: string } | undefined)?.commandName
  if (commandName && ctx.globals.debug === true) {
    console.error(`ts=${new Date().toISOString()} phase=command label=${commandName} dur_ms=${Math.round(elapsedMs)}`)
  }
}
