import { type Stats, summarize } from './stats'

/** One measured case: every sample, in nanoseconds, and their summary. */
export interface CaseResult {
  readonly name: string
  readonly unit: 'ns'
  readonly samples: readonly number[]
  readonly stats: Stats
}

export interface MeasureOptions {
  readonly warmup: number
  readonly samples: number
  /** Runs before every iteration and is not timed: resetting state, deleting a database. */
  readonly setup?: () => void
}

export function measure(name: string, options: MeasureOptions, run: () => unknown): CaseResult {
  for (let i = 0; i < options.warmup; i++) {
    options.setup?.()
    run()
  }
  const samples: number[] = []
  for (let i = 0; i < options.samples; i++) {
    options.setup?.()
    const start = process.hrtime.bigint()
    run()
    samples.push(Number(process.hrtime.bigint() - start))
  }
  return { name, unit: 'ns', samples, stats: summarize(samples) }
}

export async function measureAsync(
  name: string,
  options: MeasureOptions,
  run: () => Promise<unknown>
): Promise<CaseResult> {
  for (let i = 0; i < options.warmup; i++) {
    options.setup?.()
    await run()
  }
  const samples: number[] = []
  for (let i = 0; i < options.samples; i++) {
    options.setup?.()
    const start = process.hrtime.bigint()
    await run()
    samples.push(Number(process.hrtime.bigint() - start))
  }
  return { name, unit: 'ns', samples, stats: summarize(samples) }
}
