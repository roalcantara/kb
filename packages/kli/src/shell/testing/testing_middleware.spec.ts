import { expect, test } from 'bun:test'

import { withCommand } from '../../core/commands/with_command.factory.ts'
import { testCommand, testMiddleware } from './testing.ts'

test('testCommand captures stdout and returns exitCode 0', async () => {
  const command = withCommand({
    name: 'ok',
    desc: 'ok',
    run: () => {
      console.log('hello test')
    }
  })

  const result = await testCommand(command, { args: {}, opts: {}, globals: {}, deps: {} })
  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('hello test')
  expect(result.stderr).toBe('')
})

test('testCommand captures throw and returns exitCode 1', async () => {
  const command = withCommand({
    name: 'boom',
    desc: 'boom',
    run: () => {
      throw new Error('failed command')
    }
  })

  const result = await testCommand(command, { args: {}, opts: {}, globals: {}, deps: {} })
  expect(result.exitCode).toBe(1)
  expect(result.stderr).toContain('failed command')
})

const emptyCtx = { args: {}, opts: {}, globals: {}, deps: {} }

test('sequential testCommand calls keep isolated stdout (console restored)', async () => {
  const first = withCommand({
    name: 'a',
    desc: 'a',
    run: () => {
      console.log('only-a')
    }
  })
  const second = withCommand({
    name: 'b',
    desc: 'b',
    run: () => {
      console.log('only-b')
    }
  })
  const r1 = await testCommand(first, emptyCtx)
  const r2 = await testCommand(second, emptyCtx)
  expect(r1.stdout).toContain('only-a')
  expect(r1.stdout).not.toContain('only-b')
  expect(r2.stdout).toContain('only-b')
  expect(r2.stdout).not.toContain('only-a')
})

test('testCommand after throw still allows a clean follow-up run', async () => {
  const boom = withCommand({
    name: 'x',
    desc: 'x',
    run: () => {
      throw new Error('boom')
    }
  })
  const ok = withCommand({
    name: 'y',
    desc: 'y',
    run: () => {
      console.log('recovered')
    }
  })
  const r1 = await testCommand(boom, emptyCtx)
  const r2 = await testCommand(ok, emptyCtx)
  expect(r1.exitCode).toBe(1)
  expect(r2.exitCode).toBe(0)
  expect(r2.stdout).toContain('recovered')
})

test('testMiddleware reports nextCalled true', async () => {
  const result = await testMiddleware(
    async (_ctx: { ok: boolean }, next) => {
      await next()
    },
    { ok: true }
  )
  expect(result.exitCode).toBe(0)
  expect(result.nextCalled).toBe(true)
})

test('testMiddleware reports nextCalled false when skipped', async () => {
  const result = await testMiddleware(async () => undefined, { ok: true })
  expect(result.exitCode).toBe(0)
  expect(result.nextCalled).toBe(false)
})
