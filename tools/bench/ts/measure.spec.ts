import { describe, expect, test } from 'bun:test'
import { measure, measureAsync } from './measure'

describe('measure', () => {
  test('runs warmup and sample iterations and records one sample each', () => {
    let calls = 0
    const result = measure('count', { warmup: 3, samples: 5 }, () => {
      calls++
    })
    expect(calls).toBe(8)
    expect(result.name).toBe('count')
    expect(result.unit).toBe('ns')
    expect(result.samples).toHaveLength(5)
    expect(result.stats.n).toBe(5)
  })

  test('runs setup before every iteration, outside the timed span', () => {
    const order: string[] = []
    measure('order', { warmup: 1, samples: 1, setup: () => order.push('setup') }, () => {
      order.push('run')
    })
    expect(order).toEqual(['setup', 'run', 'setup', 'run'])
  })
})

describe('measureAsync', () => {
  test('awaits each iteration before timing the next', async () => {
    let active = 0
    let maxActive = 0
    await measureAsync('serial', { warmup: 1, samples: 3 }, async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await Bun.sleep(1)
      active--
    })
    expect(maxActive).toBe(1)
  })
})
