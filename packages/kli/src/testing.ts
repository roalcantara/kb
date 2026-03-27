import type { ArgsDef, OptsDef } from './parse_argv.ts'
import type { CliCommand, CommandHandlerContext, Middleware, ResolvedOptValues } from './with_command.ts'

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

function createConsoleBuffer(): ConsoleBuffer {
  return { stdout: [], stderr: [] }
}

function toLine(value: unknown): string {
  return String(value)
}

function toOutput(lines: string[]): string {
  if (lines.length === 0) return ''
  return `${lines.join('\n')}\n`
}

async function withCapturedConsole<T>(
  run: (buffer: ConsoleBuffer) => Promise<T>
): Promise<{ value: T; buffer: ConsoleBuffer }> {
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

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function toTestResult(buffer: ConsoleBuffer, exitCode: number): TestResult {
  return {
    stdout: toOutput(buffer.stdout),
    stderr: toOutput(buffer.stderr),
    exitCode
  }
}

async function runWithCapture(run: () => Promise<void>): Promise<{ buffer: ConsoleBuffer; exitCode: number }> {
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

export async function testCommand<
  DepsT,
  ArgsT extends Record<string, unknown> = Record<string, unknown>,
  OptsT extends Record<string, unknown> = Record<string, unknown>,
  GlobalDefsT extends OptsDef = OptsDef,
  GlobalsT extends ResolvedOptValues<GlobalDefsT> = ResolvedOptValues<GlobalDefsT>
>(
  command: CliCommand<DepsT, ArgsDef, OptsDef, GlobalDefsT>,
  ctx: CommandHandlerContext<ArgsT, OptsT, DepsT, GlobalsT>
): Promise<TestResult> {
  const { buffer, exitCode } = await runWithCapture(async () => {
    await command.run(ctx as CommandHandlerContext<Record<string, unknown>, Record<string, unknown>, DepsT, GlobalsT>)
  })
  return toTestResult(buffer, exitCode)
}

export async function testMiddleware<CtxT>(middleware: Middleware<CtxT>, ctx: CtxT): Promise<MiddlewareTestResult> {
  let nextCalled = false
  const { buffer, exitCode } = await runWithCapture(async () => {
    await middleware(ctx, () => {
      nextCalled = true
      return Promise.resolve()
    })
  })
  return { ...toTestResult(buffer, exitCode), nextCalled }
}
