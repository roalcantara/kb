import { spyOn } from 'bun:test'

type LogSpy = { mock: { calls: unknown[][] } }

const joinLoggedText = (log: LogSpy): string =>
  log.mock.calls
    .map(call => call.map(String).join(' '))
    .join('\n')
    .trim()

const argvForShell = (entrypoint: string, tokens: readonly string[]): string[] => ['bun', entrypoint, ...tokens]

type RunAndCaptureStdoutOptions = {
  runCli: (argv: string[]) => Promise<number>
  /** Defaults to `src/shell/index.ts`. */
  entrypoint?: string
  tokens: readonly string[]
}

const runAndCaptureStdout = async ({
  runCli,
  entrypoint = 'src/shell/index.ts',
  tokens
}: RunAndCaptureStdoutOptions): Promise<{ code: number; text: string }> => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined)
  try {
    const code = await runCli(argvForShell(entrypoint, tokens))
    return { code, text: joinLoggedText(log) }
  } finally {
    log.mockRestore()
  }
}

type RunEmitterAndCaptureConsoleOptions = {
  // Intentionally opaque: callers may pass strongly-typed interceptors.
  emitter: { interceptor: unknown }
  output: unknown
  format: unknown
}

const runEmitterAndCaptureConsole = async ({
  emitter,
  output,
  format
}: RunEmitterAndCaptureConsoleOptions): Promise<{ stdout: string; stderr: string }> => {
  const out = spyOn(console, 'log').mockImplementation(() => undefined)
  const err = spyOn(console, 'error').mockImplementation(() => undefined)
  try {
    const interceptor = emitter.interceptor as (ctx: unknown, next: () => Promise<unknown>) => Promise<unknown>
    await interceptor(
      {
        deps: {},
        args: {},
        opts: {},
        globals: { format }
      },
      async () => output
    )
    return { stdout: joinLoggedText(out), stderr: joinLoggedText(err) }
  } finally {
    out.mockRestore()
    err.mockRestore()
  }
}

const mocks = {
  runAndCaptureStdout,
  runEmitterAndCaptureConsole
} as const

type Mocks = typeof mocks
type MockName = keyof Mocks

export const mock_for: <N extends MockName>(name: N, opts: Parameters<Mocks[N]>[0]) => ReturnType<Mocks[N]> = (
  name,
  opts
) => {
  type AnyFn = (o: unknown) => unknown
  return (mocks[name] as AnyFn)(opts) as ReturnType<Mocks[typeof name]>
}
