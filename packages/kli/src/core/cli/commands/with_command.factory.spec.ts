import { describe, expect, it } from 'bun:test'

import { withCommand } from './with_command.factory.ts'

describe('withCommand()', () => {
  describe('when building a full command', () => {
    const run = () => undefined
    const command = withCommand({
      name: 'info',
      desc: 'Print info',
      args: { target: { type: 'string' } },
      opts: { format: { type: 'string' } },
      run
    })

    it('preserves desc', () => {
      expect(command.desc).toBe('Print info')
    })

    it('preserves args', () => {
      expect(command.args).toEqual({ target: { type: 'string' } })
    })

    it('preserves opts', () => {
      expect(command.opts).toEqual({ format: { type: 'string' } })
    })

    it('preserves run', () => {
      expect(command.run).toBe(run)
    })
  })

  describe('when middleware is passed', () => {
    it('keeps middleware reference', () => {
      const middleware = [async (_ctx: unknown, next: () => Promise<void>) => next()]
      const command = withCommand({
        name: 'info',
        desc: 'Print info',
        middleware,
        run: () => undefined
      })
      expect(command.middleware).toBe(middleware)
    })
  })

  describe('when middleware is omitted', () => {
    it('leaves middleware undefined', () => {
      const command = withCommand({
        name: 'info',
        desc: 'Print info',
        run: () => undefined
      })
      expect(command.middleware).toBeUndefined()
    })
  })
})
