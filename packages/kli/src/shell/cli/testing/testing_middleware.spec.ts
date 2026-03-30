import { describe, expect, it } from 'bun:test'

import { withCommand } from '@kli/core/cli'
import { testCommand, testMiddleware } from './testing.ts'

const emptyCtx = { args: {}, opts: {}, globals: {}, deps: {} }

describe('testCommand()', () => {
  describe('when command logs to stdout', () => {
    it('returns exitCode 0', async () => {
      const command = withCommand({
        name: 'ok',
        desc: 'ok',
        run: () => {
          console.log('hello test')
        }
      })
      const result = await testCommand(command, emptyCtx)
      expect(result.exitCode).toBe(0)
    })

    it('captures stdout', async () => {
      const command = withCommand({
        name: 'ok',
        desc: 'ok',
        run: () => {
          console.log('hello test')
        }
      })
      const result = await testCommand(command, emptyCtx)
      expect(result.stdout).toContain('hello test')
    })

    it('leaves stderr empty', async () => {
      const command = withCommand({
        name: 'ok',
        desc: 'ok',
        run: () => {
          console.log('hello test')
        }
      })
      const result = await testCommand(command, emptyCtx)
      expect(result.stderr).toBe('')
    })
  })

  describe('when command throws', () => {
    it('returns exitCode 1', async () => {
      const command = withCommand({
        name: 'boom',
        desc: 'boom',
        run: () => {
          throw new Error('failed command')
        }
      })
      const result = await testCommand(command, emptyCtx)
      expect(result.exitCode).toBe(1)
    })

    it('captures error in stderr', async () => {
      const command = withCommand({
        name: 'boom',
        desc: 'boom',
        run: () => {
          throw new Error('failed command')
        }
      })
      const result = await testCommand(command, emptyCtx)
      expect(result.stderr).toContain('failed command')
    })
  })

  describe('when running two commands in sequence', () => {
    it('isolates stdout per run', async () => {
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
  })

  describe('when first command throws', () => {
    it('still runs second command cleanly', async () => {
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
  })
})

describe('testMiddleware()', () => {
  describe('when next is awaited', () => {
    it('reports nextCalled true', async () => {
      const result = await testMiddleware(
        async (_ctx: { ok: boolean }, next) => {
          await next()
        },
        { ok: true }
      )
      expect(result.nextCalled).toBe(true)
    })

    it('returns exitCode 0', async () => {
      const result = await testMiddleware(
        async (_ctx: { ok: boolean }, next) => {
          await next()
        },
        { ok: true }
      )
      expect(result.exitCode).toBe(0)
    })
  })

  describe('when next is skipped', () => {
    it('reports nextCalled false', async () => {
      const result = await testMiddleware(async () => undefined, { ok: true })
      expect(result.nextCalled).toBe(false)
    })

    it('returns exitCode 0', async () => {
      const result = await testMiddleware(async () => undefined, { ok: true })
      expect(result.exitCode).toBe(0)
    })
  })
})
