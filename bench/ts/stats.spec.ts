import { describe, expect, test } from 'bun:test'
import { percentile, summarize } from './stats'

describe('percentile', () => {
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1)

  test('is nearest-rank: the smallest sample with at least p% at or below it', () => {
    expect(percentile(hundred, 50)).toBe(50)
    expect(percentile(hundred, 95)).toBe(95)
    expect(percentile(hundred, 99)).toBe(99)
    expect(percentile(hundred, 100)).toBe(100)
  })

  test('rounds the rank up on small sets', () => {
    expect(percentile([10, 20, 30], 50)).toBe(20)
    expect(percentile([10, 20, 30], 95)).toBe(30)
  })

  test('returns the only sample for any p', () => {
    expect(percentile([7], 1)).toBe(7)
    expect(percentile([7], 99)).toBe(7)
  })

  test('rejects an empty sample set', () => {
    expect(() => percentile([], 50)).toThrow(RangeError)
  })
})

describe('summarize', () => {
  test('sorts before reading percentiles and reports the mean', () => {
    expect(summarize([30, 10, 20, 40])).toEqual({ n: 4, min: 10, p50: 20, p95: 40, p99: 40, max: 40, mean: 25 })
  })

  test('rejects an empty sample set', () => {
    expect(() => summarize([])).toThrow(RangeError)
  })
})
