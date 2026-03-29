import { expect, test } from 'bun:test'

import { type InfoCommandTestCtx, makeCtx, makeDeps, type ShellDeps } from './ctx.factory.ts'

test('makeDeps provides a greeter function', () => {
  const deps = makeDeps()
  expect(typeof deps.greeter).toBe('function')
})

test('makeDeps accepts overrides', () => {
  const custom: ShellDeps = {
    greeter: () => 'override'
  }
  expect(makeDeps(custom).greeter({ name: 'x', times: 1 })).toBe('override')
})

test('makeCtx fills args, opts, globals for command tests', () => {
  const ctx: InfoCommandTestCtx = makeCtx()
  expect(ctx.args.path).toContain('config')
  expect(ctx.opts.source).toContain('sources')
  expect(ctx.globals.verbose).toBe(false)
})
