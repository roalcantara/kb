import { expect, spyOn, test } from 'bun:test'

import { withCommand } from '../../core/commands/with_command.factory.ts'
import { createKli } from './create_kli.factory.ts'

const pkg = { name: 't', version: '1.0.0', description: 't' }
const SETUP_ERR = /shell\.(setup|setupCommands)/

test('setup returns runner that dispatches with given argv', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined)
  const shell = createKli({ packageJson: pkg, deps: {}, globals: {} })
  const ping = withCommand({
    name: 'ping',
    desc: 'p',
    run: () => {
      console.log('pong')
    }
  })
  const runCli = shell.setupCommands(ping)
  const code = await runCli(['bun', 'x.ts', 'ping'])
  expect(code).toBe(0)
  expect(log).toHaveBeenCalledWith('pong')
  log.mockRestore()
})

test('setup throws when no commands', () => {
  const shell = createKli({ packageJson: pkg, deps: {}, globals: {} })
  expect(() => shell.setup({ commands: [] })).toThrow(SETUP_ERR)
  expect(() => shell.setupCommands()).toThrow(SETUP_ERR)
})

test('setup accepts { commands } object form', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined)
  const shell = createKli({ packageJson: pkg, deps: {}, globals: {} })
  const ping = withCommand({
    name: 'ping',
    desc: 'p',
    run: () => {
      console.log('pong')
    }
  })
  const runCli = shell.setup({ commands: [ping] })
  const code = await runCli(['bun', 'x.ts', 'ping'])
  expect(code).toBe(0)
  expect(log).toHaveBeenCalledWith('pong')
  log.mockRestore()
})

test('setup merges defineEmitter globals and uses custom run', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined)
  const shell = createKli({ packageJson: pkg, deps: {}, globals: {} })
  const ping = withCommand({
    name: 'ping',
    desc: 'p',
    run: () => ({ n: 1 })
  })
  const emitter = shell.defineEmitter({
    globals: {
      style: { type: 'string' as const, default: 'json' }
    },
    run: (output, { globals }) => {
      if (globals.style === 'json') console.log(JSON.stringify(output))
    }
  })
  const runCli = shell.setup({ commands: [ping], emitter })
  expect(await runCli(['bun', 'x.ts', 'ping'])).toBe(0)
  expect(log).toHaveBeenCalledWith('{"n":1}')
  log.mockRestore()
})
