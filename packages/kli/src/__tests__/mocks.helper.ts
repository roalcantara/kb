import { mock, spyOn } from 'bun:test'
import { withCommand, type ArgsDef, type CliCommand, type Middleware, type OptsDef } from '@kli/core/cli'
import { createKli, withCli } from '@kli/shell/cli'
import { factory_for } from './factories.helper'

const mockCreateKli = <T extends Partial<ReturnType<typeof createKli>>>(props: T = {} as T) => {
  const pkg = factory_for('pkg')
  return createKli({ packageJson: pkg, deps: {}, globals: {}, ...props })
}
const mockWithCommandBase = <T>(run: () => T) => {
  const shell = mockCreateKli()
  const log = spyOn(console, 'log').mockImplementation(() => undefined)
  const ping = withCommand({
    name: 'ping',
    desc: 'p',
    run
  })
  return {
    shell,
    ping,
    log
  }
}
const mockWithCommand = () =>
  mockWithCommandBase(() => {
    console.log('pong')
  })
const mockWithCommandWithEmitter = () => {
  const { log, ping, shell } = mockWithCommandBase(() => ({ n: 1 }))
  const emitter = shell.defineEmitter({
    globals: {
      style: { type: 'string' as const, default: 'json' }
    },
    run: (output, { globals }) => {
      if (globals.style === 'json') console.log(JSON.stringify(output))
    }
  })
  return {
    shell,
    ping,
    log,
    emitter
  }
}
const mockWithCommandWithInvalidValidation = () => {
  const globals = factory_for('mainCliGlobals')
  type TestGlobals = typeof globals
  return withCommand<
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
}
const mockHandlerWithNextCommand = () => (middleware: Middleware<unknown>) => {
  const handler = mock((_ctx: unknown) => undefined)
  const command = factory_for('mainCliDemoInfo', {
    middleware: [middleware],
    run: handler
  })
  return {
    handler,
    command
  }
}

const BASE_PACKAGE = factory_for('cliDemoPkg')
const TEST_GLOBALS = factory_for('mainCliGlobals')
type TestGlobals = typeof TEST_GLOBALS

/** Test {@link withCli} fixture with optional deps/middleware/commands overrides. */
const mockCreateCli = (overrides?: {
  deps?: unknown
  middleware?: readonly Middleware<unknown>[]
  commands?: readonly unknown[]
  tui?: unknown
}) =>
  withCli({
    name: 'demo',
    packageJson: BASE_PACKAGE,
    deps: overrides?.deps ?? { marker: 'deps' },
    globals: TEST_GLOBALS,
    middleware: overrides?.middleware ?? [],
    interceptors: [],
    commands: (overrides?.commands ?? [factory_for('mainCliDemoInfo')]) as unknown as readonly CliCommand<
      unknown,
      ArgsDef,
      OptsDef,
      TestGlobals
    >[],
    ...(overrides?.tui === undefined ? {} : { tui: overrides.tui })
  })

type WithStdoutTtyOptions = { isTty: boolean; fn: () => Promise<void> }
const mockWithStdoutTty =
  ({ isTty, fn }: WithStdoutTtyOptions) =>
  async () => {
    const prev = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      enumerable: prev?.enumerable ?? true,
      get: () => isTty
    })
    try {
      await fn()
    } finally {
      if (prev) Object.defineProperty(process.stdout, 'isTTY', prev)
    }
  }

type EmptyOptions = Record<never, never>

/**
 * Single source of truth: each entry is a wrapper that normalizes the API
 * to a single `options?` argument.
 */
const mocks = {
  withCommand: (_opts?: EmptyOptions) => mockWithCommand(),
  withCommandWithEmitter: (_opts?: EmptyOptions) => mockWithCommandWithEmitter(),
  createKli: (props?: Parameters<typeof mockCreateKli>[0]) => mockCreateKli(props ?? {}),
  createCli: (overrides?: Parameters<typeof mockCreateCli>[0]) => mockCreateCli(overrides),
  withStdoutTty: (opts: Parameters<typeof mockWithStdoutTty>[0]) => mockWithStdoutTty(opts),
  handlerWithNextCommand: (_opts?: EmptyOptions) => mockHandlerWithNextCommand(),
  withCommandWithInvalidValidation: (_opts?: EmptyOptions) => mockWithCommandWithInvalidValidation()
} as const

type Mocks = typeof mocks
type MockNames = keyof Mocks

export const mock_for: <N extends MockNames>(name: N, ...args: Parameters<Mocks[N]>) => ReturnType<Mocks[N]> = (
  name,
  ...args
) => {
  type AnyFn = (...a: unknown[]) => unknown
  return (mocks[name] as AnyFn)(...args) as ReturnType<Mocks[typeof name]>
}
