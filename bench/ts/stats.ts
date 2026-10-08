/** A sample set reduced to the figures every result reports. Units are the samples' own. */
export interface Stats {
  readonly n: number
  readonly min: number
  readonly p50: number
  readonly p95: number
  readonly p99: number
  readonly max: number
  readonly mean: number
}

/**
 * The nearest-rank percentile of samples sorted ascending: the smallest sample with at least
 * `p` percent of the set at or below it. No interpolation, so every figure reported is a time
 * that was actually measured. kb-bench (Plan 2) implements the same definition.
 */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new RangeError('percentile of an empty sample set')
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length))
  return sorted[Math.min(rank, sorted.length) - 1] as number
}

export function summarize(samples: readonly number[]): Stats {
  if (samples.length === 0) throw new RangeError('summary of an empty sample set')
  const sorted = [...samples].sort((a, b) => a - b)
  const sum = sorted.reduce((acc, value) => acc + value, 0)
  return {
    n: sorted.length,
    min: sorted[0] as number,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] as number,
    mean: sum / sorted.length
  }
}
