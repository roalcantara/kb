import { expect, test } from 'bun:test'
import { makeCtx, makeDeps } from './ctx.factory.ts'

test('makeDeps returns an empty object', () => {
  expect(makeDeps()).toEqual({})
})

test('makeCtx merges globals overrides', () => {
  const ctx = makeCtx({ globals: { debug: true } })
  expect(ctx.globals.debug).toBe(true)
  expect(ctx.globals.config).toContain('kodexb')
})
