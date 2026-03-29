import { describe, expect, test } from 'bun:test'

import { withCommand } from './with_command.factory.ts'

describe('with_command', () => {
  test('keeps desc, args, opts, and run', () => {
    const run = () => undefined
    const command = withCommand({
      name: 'info',
      desc: 'Print info',
      args: { target: { type: 'string' } },
      opts: { format: { type: 'string' } },
      run
    })

    expect(command.desc).toBe('Print info')
    expect(command.args).toEqual({ target: { type: 'string' } })
    expect(command.opts).toEqual({ format: { type: 'string' } })
    expect(command.run).toBe(run)
  })

  test('keeps middleware when provided', () => {
    const middleware = [async (_ctx: unknown, next: () => Promise<void>) => next()]
    const command = withCommand({
      name: 'info',
      desc: 'Print info',
      middleware,
      run: () => undefined
    })

    expect(command.middleware).toBe(middleware)
  })

  test('middleware remains undefined when omitted', () => {
    const command = withCommand({
      name: 'info',
      desc: 'Print info',
      run: () => undefined
    })
    expect(command.middleware).toBeUndefined()
  })
})
