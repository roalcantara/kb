import { describe, expect, it } from 'bun:test'
import { mock_for } from '@kli/tests'

const SETUP_ERR = /shell\.(setup|setupCommands)/

describe('createKli()', () => {
  describe('setup()', () => {
    it('returns runner that dispatches with given argv', async () => {
      const { log, ping, shell } = mock_for('withCommand')
      const runCli = shell.setupCommands(ping)
      const code = await runCli(['bun', 'x.ts', 'ping'])
      expect(code).toBe(0)
      expect(log).toHaveBeenCalledWith('pong')
      log.mockRestore()
    })

    it('accepts { commands } object form', async () => {
      const { shell, ping, log } = mock_for('withCommand')
      const runCli = shell.setup({ commands: [ping] })
      const code = await runCli(['bun', 'x.ts', 'ping'])
      expect(code).toBe(0)
      expect(log).toHaveBeenCalledWith('pong')
      log.mockRestore()
    })

    describe('when commands list is empty', () => {
      it('rejects setup with empty commands', () => {
        const { shell } = mock_for('withCommand')
        expect(() => shell.setup({ commands: [] })).toThrow(SETUP_ERR)
      })

      it('rejects setupCommands with no args', () => {
        const { shell } = mock_for('withCommand')
        expect(() => shell.setupCommands()).toThrow(SETUP_ERR)
      })
    })

    it('merges defineEmitter globals and uses custom run', async () => {
      const { log, ping, shell, emitter } = mock_for('withCommandWithEmitter')
      const runCli = shell.setup({ commands: [ping], emitter })
      expect(await runCli(['bun', 'x.ts', 'ping'])).toBe(0)
      expect(log).toHaveBeenCalledWith('{"n":1}')
      log.mockRestore()
    })
  })
})
