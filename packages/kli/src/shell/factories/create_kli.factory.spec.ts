import { expect, spyOn, test } from 'bun:test'

import { withCommand } from '../../core/commands/with_command.factory.ts'
import { createKli } from './create_kli.factory.ts'

const pkg = { name: 't', version: '1.0.0', description: 't' }
const SETUP_ERR = /shell\.setup/

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
  const runCli = shell.setup(ping)
  const code = await runCli(['bun', 'x.ts', 'ping'])
  expect(code).toBe(0)
  expect(log).toHaveBeenCalledWith('pong')
  log.mockRestore()
})

test('setup throws when no commands', () => {
  const shell = createKli({ packageJson: pkg, deps: {}, globals: {} })
  expect(() => shell.setup()).toThrow(SETUP_ERR)
})
