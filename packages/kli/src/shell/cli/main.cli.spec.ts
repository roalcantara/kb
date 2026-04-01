import { describe, expect, mock, spyOn, it } from 'bun:test'
import type { ArgsDef, CliCommand, CliInterceptor, Middleware, OptsDef } from '@kli/core/cli'
import { factory_for, mock_for } from '@kli/tests'
import { withCli } from './factories'
import { runCommand } from './main.cli.ts'

describe('runCommand()', () => {
  describe('when argv names a known command', () => {
    it('runs with expected context', async () => {
      const handler = mock((_ctx: unknown) => undefined)
      const command = factory_for('mainCliDemoInfo', { run: handler })
      const cli = mock_for('createCli', { commands: [command] })
      const code = await runCommand(cli, factory_for('bunStyleArgv', 'info'))
      expect(code).toBe(0)
      expect(handler).toHaveBeenCalled()
      const ctx = handler.mock.calls[0]?.[0] as {
        deps: unknown
        opts: { format?: string }
        globals: { region?: string }
      }
      expect(ctx.globals.region).toBe('eu-west-1')
      expect(ctx.opts.format).toBe('json')
    })
  })

  describe('when argv is --help or empty', () => {
    it('prints help and exits 0', async () => {
      const log = spyOn(console, 'log').mockImplementation(() => undefined)
      const cli = mock_for('createCli')
      expect(await runCommand(cli, factory_for('bunStyleArgv', '--help'))).toBe(0)
      expect(await runCommand(cli, factory_for('bunStyleArgv'))).toBe(0)
      expect(log).toHaveBeenCalled()
      log.mockRestore()
    })
  })

  describe('on TTY without tui', () => {
    it('prints root help', async () => {
      const log = spyOn(console, 'log').mockImplementation(() => undefined)
      const withStdoutTty = mock_for('withStdoutTty', {
        isTty: true,
        fn: async () => {
          const cli = mock_for('createCli')
          expect(await runCommand(cli, factory_for('bunStyleArgv'))).toBe(0)
          expect(log).toHaveBeenCalled()
        }
      })
      await withStdoutTty()
      log.mockRestore()
    })
  })

  describe('on TTY with tui registered', () => {
    const mockStartTui = mock_for('mockStartTui')
    it('invokes startTui', async () => {
      mockStartTui.mockClear()
      const withStdoutTty = mock_for('withStdoutTty', {
        isTty: true,
        fn: async () => {
          const cli = mock_for('createCli', { tui: () => null })
          expect(await runCommand(cli, factory_for('bunStyleArgv'))).toBe(0)
          expect(mockStartTui).toHaveBeenCalled()
        }
      })
      await withStdoutTty()
    })
  })

  describe('when argv is --version', () => {
    it('prints version and exits 0', async () => {
      const log = spyOn(console, 'log').mockImplementation(() => undefined)
      const cli = mock_for('createCli')
      const code = await runCommand(cli, factory_for('bunStyleArgv', '--version'))
      expect(code).toBe(0)
      expect(log).toHaveBeenCalledWith('demo 1.0.0')
      log.mockRestore()
    })
  })

  describe('when command is unknown', () => {
    it('exits 1', async () => {
      const err = spyOn(console, 'error').mockImplementation(() => undefined)
      const code = await runCommand(mock_for('createCli'), factory_for('bunStyleArgv', 'unknown'))
      expect(code).toBe(1)
      expect(err).toHaveBeenCalled()
      err.mockRestore()
    })
  })

  describe('when option is unknown', () => {
    it('exits 1 with unknown option message', async () => {
      const err = spyOn(console, 'error').mockImplementation(() => undefined)
      const code = await runCommand(mock_for('createCli'), factory_for('bunStyleArgv', 'info', '--config=missing.yaml'))
      expect(code).toBe(1)
      expect(String(err.mock.calls[0]?.[0])).toContain('Unknown option')
      err.mockRestore()
    })
  })

  describe('when validation fails', () => {
    it('exits 1', async () => {
      const command = mock_for('withCommandWithInvalidValidation')
      const err = spyOn(console, 'error').mockImplementation(() => undefined)
      const code = await runCommand(mock_for('createCli', { commands: [command] }), factory_for('bunStyleArgv', 'info'))
      expect(code).toBe(1)
      const printed = err.mock.calls.map(call => String(call[0])).join('\n')
      expect(printed).toContain('Missing required arg: target')
      expect(printed).toContain('Missing required opt: config')
      err.mockRestore()
    })
  })

  describe('when handler throws', () => {
    it('exits 1 with command label', async () => {
      const command = factory_for('mainCliDemoInfo', {
        run: () => {
          throw new Error('boom')
        }
      })
      const err = spyOn(console, 'error').mockImplementation(() => undefined)
      const code = await runCommand(mock_for('createCli', { commands: [command] }), factory_for('bunStyleArgv', 'info'))
      expect(code).toBe(1)
      expect(String(err.mock.calls[0]?.[0])).toContain('Command "info" failed')
      err.mockRestore()
    })
  })

  describe('with global and command middleware', () => {
    it('runs in nested order', async () => {
      const order: string[] = []
      const handler = mock((ctx: unknown) => {
        const typed = ctx as {
          deps: { marker: string }
          opts: { format?: string }
          globals: { region?: string }
        }
        order.push(`handler:${typed.deps.marker}:${typed.globals.region}:${typed.opts.format}`)
      })

      const command = factory_for('mainCliDemoInfo', {
        middleware: [
          async (_ctx, next) => {
            order.push('command-before')
            await next()
            order.push('command-after')
          }
        ],
        run: handler
      })

      const globalMiddleware: readonly Middleware<unknown>[] = [
        async (_ctx, next) => {
          order.push('global-before')
          await next()
          order.push('global-after')
        }
      ]

      const cli = mock_for('createCli', {
        deps: { marker: 'deps' },
        middleware: globalMiddleware,
        commands: [command]
      })
      expect(await runCommand(cli, factory_for('bunStyleArgv', 'info'))).toBe(0)
      expect(order).toEqual([
        'global-before',
        'command-before',
        'handler:deps:eu-west-1:json',
        'command-after',
        'global-after'
      ])
    })
  })

  describe('when middleware omits next', () => {
    it('skips handler', async () => {
      const handlerWithNextCommand = mock_for('handlerWithNextCommand')
      const { handler, command } = handlerWithNextCommand(async () => undefined)
      expect(
        await runCommand(mock_for('createCli', { commands: [command] }), factory_for('bunStyleArgv', 'info'))
      ).toBe(0)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('when middleware throws', () => {
    it('exits 1', async () => {
      const handlerWithNextCommand = mock_for('handlerWithNextCommand')
      const { command } = handlerWithNextCommand(async () => Promise.reject(new Error('mw-boom')))
      const err = spyOn(console, 'error').mockImplementation(() => undefined)
      expect(
        await runCommand(mock_for('createCli', { commands: [command] }), factory_for('bunStyleArgv', 'info'))
      ).toBe(1)
      err.mockRestore()
    })
  })

  describe('with a global interceptor', () => {
    it('transforms value before emit', async () => {
      const log = spyOn(console, 'log').mockImplementation(() => undefined)
      const command = factory_for('mainCliDemoInfo', { run: () => ({ ok: true }) })
      const enrichInterceptor: CliInterceptor<unknown> = async (_ctx, next) => {
        const value = await next()
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          return { ...(value as Record<string, unknown>), tagged: true }
        }
        return value
      }
      const globals = factory_for('mainCliGlobals')
      type TestGlobals = typeof globals
      const cli = withCli({
        name: 'demo',
        packageJson: factory_for('cliDemoPkg'),
        deps: { marker: 'deps' },
        globals,
        middleware: [],
        interceptors: [enrichInterceptor],
        commands: [command] as unknown as readonly CliCommand<unknown, ArgsDef, OptsDef, TestGlobals>[]
      })
      expect(await runCommand(cli, factory_for('bunStyleArgv', 'info'))).toBe(0)
      expect(log.mock.calls[0]?.[0]).toEqual({ ok: true, tagged: true })
      log.mockRestore()
    })
  })
})
