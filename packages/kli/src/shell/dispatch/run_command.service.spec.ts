import { expect, mock, spyOn, test } from 'bun:test'
import type { CliCommand, Middleware } from '../../core/commands/command_handler.schema.ts'
import { withCommand } from '../../core/commands/with_command.factory.ts'
import type { ArgsDef, OptsDef } from '../../core/parsing/argv.schema.ts'
import { withCli } from '../factories/cli_instance.factory.ts'
import { runCommand } from './run_command.service.ts'

const BASE_PACKAGE = {
  name: 'kb',
  version: '1.0.0',
  description: 'kb cli'
}

const TEST_GLOBALS = {
  region: { type: 'string' as const, default: 'eu-west-1' }
} as const

type TestGlobals = typeof TEST_GLOBALS

/** Test {@link withCli} fixture with optional deps/middleware/commands overrides. */
const createCli = (overrides?: {
  deps?: unknown
  middleware?: readonly Middleware<unknown>[]
  /** Heterogeneous commands are erased to ArgsDef/OptsDef at the CLI boundary (run stays typed per command). */
  commands?: readonly unknown[]
}) => {
  const info = withCommand<unknown, ArgsDef, { format: { type: 'string'; default: string } }, TestGlobals>({
    name: 'info',
    desc: 'show info',
    opts: {
      format: { type: 'string', default: 'json' }
    },
    run: ({ opts }) => {
      console.log(JSON.stringify({ ok: true, format: opts.format ?? 'json' }))
    }
  })

  return withCli({
    name: 'kb',
    packageJson: BASE_PACKAGE,
    deps: overrides?.deps ?? { marker: 'deps' },
    globals: TEST_GLOBALS,
    middleware: overrides?.middleware ?? [],
    commands: (overrides?.commands ?? [info]) as unknown as readonly CliCommand<
      unknown,
      ArgsDef,
      OptsDef,
      TestGlobals
    >[]
  })
}

/** argv prefix for {@link runCommand} integration tests. */
const argv = (...tokens: string[]): string[] => ['/bun', 'index.ts', ...tokens]

test('known command runs with expected context', async () => {
  const handler = mock((_ctx: unknown) => undefined)
  const command = withCommand<unknown, ArgsDef, { format: { type: 'string'; default: string } }, TestGlobals>({
    name: 'info',
    desc: 'show info',
    opts: { format: { type: 'string', default: 'json' } },
    run: handler
  })
  const cli = createCli({ commands: [command] })
  const code = await runCommand(cli, argv('info'))
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

test('--help and no command print help and exit 0', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined)
  const cli = createCli()
  expect(await runCommand(cli, argv('--help'))).toBe(0)
  expect(await runCommand(cli, argv())).toBe(0)
  expect(log).toHaveBeenCalled()
  log.mockRestore()
})

test('--version prints version and exits 0', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined)
  const cli = createCli()
  const code = await runCommand(cli, argv('--version'))
  expect(code).toBe(0)
  expect(log).toHaveBeenCalledWith('kb 1.0.0')
  log.mockRestore()
})

test('unknown command exits 1', async () => {
  const err = spyOn(console, 'error').mockImplementation(() => undefined)
  const code = await runCommand(createCli(), argv('unknown'))
  expect(code).toBe(1)
  expect(err).toHaveBeenCalled()
  err.mockRestore()
})

test('unknown option exits 1', async () => {
  const err = spyOn(console, 'error').mockImplementation(() => undefined)
  const code = await runCommand(createCli(), argv('info', '--config=missing.yaml'))
  expect(code).toBe(1)
  expect(String(err.mock.calls[0]?.[0])).toContain('Unknown option')
  err.mockRestore()
})

test('validation failure exits 1 and prints all errors', async () => {
  const command = withCommand<
    unknown,
    { target: { type: 'string'; required: true } },
    { config: { type: 'file'; required: true } },
    TestGlobals
  >({
    name: 'info',
    desc: 'show info',
    args: { target: { type: 'string', required: true } },
    opts: { config: { type: 'file', required: true } },
    run: () => undefined
  })
  const err = spyOn(console, 'error').mockImplementation(() => undefined)
  const code = await runCommand(createCli({ commands: [command] }), argv('info'))
  expect(code).toBe(1)
  const printed = err.mock.calls.map(call => String(call[0])).join('\n')
  expect(printed).toContain('Missing required arg: target')
  expect(printed).toContain('Missing required opt: config')
  err.mockRestore()
})

test('handler throw exits 1 with command context', async () => {
  const command = withCommand<unknown, ArgsDef, OptsDef, TestGlobals>({
    name: 'info',
    desc: 'show info',
    run: () => {
      throw new Error('boom')
    }
  })
  const err = spyOn(console, 'error').mockImplementation(() => undefined)
  const code = await runCommand(createCli({ commands: [command] }), argv('info'))
  expect(code).toBe(1)
  expect(String(err.mock.calls[0]?.[0])).toContain('Command "info" failed')
  err.mockRestore()
})

test('global and command middleware run in order', async () => {
  const order: string[] = []
  const handler = mock((ctx: unknown) => {
    const typed = ctx as {
      deps: { marker: string }
      opts: { format?: string }
      globals: { region?: string }
    }
    order.push(`handler:${typed.deps.marker}:${typed.globals.region}:${typed.opts.format}`)
  })

  const command = withCommand<unknown, ArgsDef, { format: { type: 'string'; default: string } }, TestGlobals>({
    name: 'info',
    desc: 'show info',
    opts: { format: { type: 'string', default: 'json' } },
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

  const cli = createCli({
    deps: { marker: 'deps' },
    middleware: globalMiddleware,
    commands: [command]
  })
  expect(await runCommand(cli, argv('info'))).toBe(0)
  expect(order).toEqual([
    'global-before',
    'command-before',
    'handler:deps:eu-west-1:json',
    'command-after',
    'global-after'
  ])
})

test('middleware without next short-circuits handler', async () => {
  const handler = mock((_ctx: unknown) => undefined)
  const noNextCommand = withCommand<unknown, ArgsDef, OptsDef, TestGlobals>({
    name: 'info',
    desc: 'show info',
    middleware: [async () => undefined],
    run: handler
  })
  expect(await runCommand(createCli({ commands: [noNextCommand] }), argv('info'))).toBe(0)
  expect(handler).not.toHaveBeenCalled()
})

test('middleware throw exits 1', async () => {
  const handler = mock((_ctx: unknown) => undefined)
  const throwMiddlewareCommand = withCommand<unknown, ArgsDef, OptsDef, TestGlobals>({
    name: 'info',
    desc: 'show info',
    middleware: [
      () => {
        throw new Error('mw-boom')
      }
    ],
    run: handler
  })
  const err = spyOn(console, 'error').mockImplementation(() => undefined)
  expect(await runCommand(createCli({ commands: [throwMiddlewareCommand] }), argv('info'))).toBe(1)
  err.mockRestore()
})
