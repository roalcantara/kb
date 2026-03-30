import { describe, expect, it } from 'bun:test'

import type { CliInterceptor, Middleware } from '@kli/core/cli'
import { runChain, runInterceptorChain } from './index.ts'

describe('runInterceptorChain()', () => {
  describe('with an empty list', () => {
    it('returns handler value', async () => {
      const out = await runInterceptorChain([], {}, async () => ({ a: 1 }))
      expect(out).toEqual({ a: 1 })
    })
  })

  describe('with outer and inner interceptors', () => {
    it('runs outer before inner around handler', async () => {
      const order: string[] = []
      const outer: CliInterceptor<Record<string, never>> = async (_ctx, next) => {
        order.push('outer-before')
        const v = await next()
        order.push('outer-after')
        return v
      }
      const inner: CliInterceptor<Record<string, never>> = async (_ctx, next) => {
        order.push('inner-before')
        const v = await next()
        order.push('inner-after')
        return v
      }
      const result = await runInterceptorChain([outer, inner], {}, () => {
        order.push('handler')
        return 42
      })
      expect(result).toBe(42)
      expect(order).toEqual(['outer-before', 'inner-before', 'handler', 'inner-after', 'outer-after'])
    })
  })

  describe('when first slot is a hole', () => {
    it('skips remaining interceptors', async () => {
      let innerRan = false
      const inner: CliInterceptor<Record<string, never>> = (_ctx, next) => {
        innerRan = true
        return next()
      }
      const withHole = [undefined, inner] as unknown as readonly CliInterceptor<Record<string, never>>[]
      const out = await runInterceptorChain(withHole, {}, async () => 41)
      expect(out).toBe(41)
      expect(innerRan).toBe(false)
    })
  })
})

describe('runChain()', () => {
  describe('with empty middleware', () => {
    it('runs handler', async () => {
      let ran = false
      await runChain(
        [],
        {},
        () =>
          new Promise<void>(resolve => {
            ran = true
            resolve()
          })
      )
      expect(ran).toBe(true)
    })
  })

  describe('with global then local middleware', () => {
    it('orders outer before inner', async () => {
      const order: string[] = []
      const outer: Middleware<Record<string, never>> = async (_ctx, next) => {
        order.push('outer-before')
        await next()
        order.push('outer-after')
      }
      const inner: Middleware<Record<string, never>> = async (_ctx, next) => {
        order.push('inner-before')
        await next()
        order.push('inner-after')
      }
      await runChain(
        [outer, inner],
        {},
        () =>
          new Promise<void>(resolve => {
            order.push('handler')
            resolve()
          })
      )
      expect(order).toEqual(['outer-before', 'inner-before', 'handler', 'inner-after', 'outer-after'])
    })
  })

  describe('when middleware omits next', () => {
    it('skips handler', async () => {
      let ran = false
      const skip: Middleware<Record<string, never>> = async (_ctx, _next) => {
        await Promise.resolve()
      }
      await runChain(
        [skip],
        {},
        () =>
          new Promise<void>(resolve => {
            ran = true
            resolve()
          })
      )
      expect(ran).toBe(false)
    })
  })

  describe('when first slot is a hole', () => {
    it('aborts without running handler', async () => {
      let ran = false
      const afterHole: Middleware<Record<string, never>> = async (_c, next) => {
        await next()
      }
      const withHole = [undefined, afterHole] as unknown as readonly Middleware<Record<string, never>>[]
      await runChain(
        withHole,
        {},
        () =>
          new Promise<void>(resolve => {
            ran = true
            resolve()
          })
      )
      expect(ran).toBe(false)
    })
  })
})
