import type { CliCommand, CommandHandlerContext, Middleware } from '../../core/commands/command_handler.schema.ts'
import type { ArgsDef, OptsDef } from '../../core/parsing/argv.schema.ts'

type TestResult = {
  stdout: string
  stderr: string
  exitCode: number
}

type MiddlewareTestResult = TestResult & {
  nextCalled: boolean
}

type ConsoleBuffer = {
  stdout: string[]
  stderr: string[]
}

/** Empty capture buffers for mocked `console.log` / `console.error`. */
const createConsoleBuffer = (): ConsoleBuffer => ({ stdout: [], stderr: [] })

/** Stringifies a single console argument for buffer storage. */
const toLine = (value: unknown): string => String(value)

/** Joins captured lines with newlines and trailing newline (empty → `''`). */
const toOutput = (lines: string[]): string => {
  if (lines.length === 0) return ''
  return `${lines.join('\n')}\n`
}

/**
 * Temporarily replaces `console.log` / `console.error` for the duration of `run`.
 *
 * @param run - Receives the live buffer; restore happens in `finally`
 * @returns Result of `run` plus the buffer contents
 */
const withCapturedConsole = async <T>(
  run: (buffer: ConsoleBuffer) => Promise<T>
): Promise<{ value: T; buffer: ConsoleBuffer }> => {
  const originalLog = console.log
  const originalError = console.error
  const buffer = createConsoleBuffer()

  console.log = (...args: unknown[]) => {
    buffer.stdout.push(args.map(toLine).join(' '))
  }
  console.error = (...args: unknown[]) => {
    buffer.stderr.push(args.map(toLine).join(' '))
  }

  try {
    const value = await run(buffer)
    return { value, buffer }
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}

const toErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** Shapes buffer + exit code into {@link TestResult}. */
const toTestResult = (buffer: ConsoleBuffer, exitCode: number): TestResult => ({
  stdout: toOutput(buffer.stdout),
  stderr: toOutput(buffer.stderr),
  exitCode
})

/**
 * Runs `run` under captured console; uncaught errors become stderr + exit code 1.
 *
 * @returns Buffer and synthetic exit code
 */
const runWithCapture = async (run: () => Promise<void>): Promise<{ buffer: ConsoleBuffer; exitCode: number }> => {
  const { buffer, value } = await withCapturedConsole(async current => {
    try {
      await run()
      return { exitCode: 0 }
    } catch (error) {
      current.stderr.push(toErrorMessage(error))
      return { exitCode: 1 }
    }
  })

  return { buffer, exitCode: value.exitCode }
}

/**
 * Invokes a command’s `run` with a synthetic context and captures console output.
 *
 * @param command - CLI command under test
 * @param ctx - Handler context (`args`, `opts`, `globals`, `deps`)
 * @returns Captured stdout/stderr and exit code (throw in `run` → 1)
 *
 * @example
 * await testCommand(cmd, { args: {}, opts: {}, globals: {}, deps: {} })
 */
export const testCommand = async <
  DepsT,
  ArgsT extends Record<string, unknown> = Record<string, unknown>,
  OptsT extends Record<string, unknown> = Record<string, unknown>,
  GlobalDefsT extends OptsDef = OptsDef,
  GlobalsMapT extends Record<string, unknown> = Record<string, never>
>(
  command: CliCommand<DepsT, ArgsDef, OptsDef, GlobalDefsT>,
  ctx: CommandHandlerContext<ArgsT, OptsT, DepsT, GlobalsMapT>
): Promise<TestResult> => {
  const { buffer, exitCode } = await runWithCapture(async () => {
    await command.run(ctx as Parameters<(typeof command)['run']>[0])
  })
  return toTestResult(buffer, exitCode)
}

/**
 * Runs a single middleware with a stub `next`; records whether `next` was invoked.
 *
 * @param middleware - Middleware under test
 * @param ctx - Context passed through
 * @returns Console capture, exit code, and `nextCalled`
 *
 * @example
 * await testMiddleware(mw, { deps: {} })
 */
export const testMiddleware = async <CtxT>(middleware: Middleware<CtxT>, ctx: CtxT): Promise<MiddlewareTestResult> => {
  let nextCalled = false
  const { buffer, exitCode } = await runWithCapture(async () => {
    await middleware(ctx, () => {
      nextCalled = true
      return Promise.resolve()
    })
  })
  return { ...toTestResult(buffer, exitCode), nextCalled }
}
