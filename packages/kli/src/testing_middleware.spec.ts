import { expect, test } from 'bun:test'

import { testCommand, testMiddleware } from './testing.ts'
import { withCommand } from './with_command.ts'

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
