import type { CommandHandlerContext, Middleware } from '@kb/kli'

import type { AppDeps } from '../deps.factory.ts'

type TimingCtx = CommandHandlerContext<
  Record<string, unknown>,
  Record<string, unknown> & { verbose?: boolean },
  AppDeps,
  { verbose?: boolean }
>

const NANOSECONDS_PER_MILLISECOND = 1_000_000

export const timingMiddleware: Middleware<TimingCtx> = async (ctx, next) => {
  const startedAt = process.hrtime.bigint()
  await next()

  if (!ctx.opts.verbose) return

  const elapsedNs = process.hrtime.bigint() - startedAt
  const elapsedMs = Number(elapsedNs) / NANOSECONDS_PER_MILLISECOND
  console.error(`Execution time: ${elapsedMs.toFixed(2)}ms`)
}
