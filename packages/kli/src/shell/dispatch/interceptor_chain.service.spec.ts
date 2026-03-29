import { expect, test } from 'bun:test'

import type { CliInterceptor } from '../../core/commands/command_handler.schema.ts'
import { runInterceptorChain } from './interceptor_chain.service.ts'

test('runInterceptorChain passes handler result through empty list', async () => {
  const out = await runInterceptorChain([], {}, async () => ({ a: 1 }))
  expect(out).toEqual({ a: 1 })
})

test('runInterceptorChain composes outer interceptors first', async () => {
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
