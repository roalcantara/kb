import { printCommandHelp, printHelp, printVersion } from './help_command.ts'
import { normalizeArgv } from './minimal_cli.ts'
import { type ArgsDef, type OptsDef, type ParseResult, parseArgv } from './parse_argv.ts'
import { validateCommand } from './validate_command.ts'
import type { CliInstance } from './with_cli.ts'
import type { CliCommand, CommandHandlerContext, Middleware } from './with_command.ts'

const EXIT_OK = 0
const EXIT_ERROR = 1
const HELP_SHORT = '-h'
const HELP_LONG = '--help'
const VERSION_LONG = '--version'

type RunContext<DepsT> = CommandHandlerContext<Record<string, unknown>, Record<string, unknown>, DepsT> & {
  raw: ParseResult
}

function firstNonFlag(args: readonly string[]): string | undefined {
  return args.find(arg => !arg.startsWith('-'))
}

function startTuiStub(): number {
  console.log('TUI phase 2')
  return EXIT_OK
}

async function runChain<CtxT>(
  middlewares: readonly Middleware<CtxT>[],
  ctx: CtxT,
  handler: () => Promise<void>,
  index = 0
): Promise<void> {
  if (index >= middlewares.length) {
    await handler()
    return
  }

  const middleware = middlewares[index]
  if (!middleware) return

  await middleware(ctx, async () => {
    // Short-circuit is automatic when middleware omits next().
    await runChain(middlewares, ctx, handler, index + 1)
  })
}

function resolveCommand<
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef>[]
>(cli: CliInstance<DepsT, GlobalsT, CommandsT>, parsed: ParseResult): CliCommand<DepsT, ArgsDef, OptsDef> | undefined {
  if (!parsed.commandName) return
  return cli.commands.find(command => command.name === parsed.commandName)
}

function handleHelpOrVersion<
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef>[]
>(
  cli: CliInstance<DepsT, GlobalsT, CommandsT>,
  args: readonly string[],
  knownCommand: CliCommand<DepsT, ArgsDef, OptsDef> | undefined
): number | undefined {
  if (args.includes(HELP_SHORT) || args.includes(HELP_LONG)) {
    if (knownCommand) {
      printCommandHelp(cli, knownCommand, knownCommand.name)
      return EXIT_OK
    }
    printHelp(cli, cli.commands)
    return EXIT_OK
  }

  if (args.includes(VERSION_LONG)) {
    printVersion(cli)
    return EXIT_OK
  }
}

function handleMissingCommand<
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef>[]
>(cli: CliInstance<DepsT, GlobalsT, CommandsT>, args: readonly string[]): number {
  const unknownCommand = firstNonFlag(args)
  if (unknownCommand) {
    console.error(`Unknown command: ${unknownCommand}`)
    return EXIT_ERROR
  }
  if (process.stdout.isTTY && cli.tui) return startTuiStub()
  printHelp(cli, cli.commands)
  return EXIT_OK
}

async function executeKnownCommand<
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef>[]
>(
  cli: CliInstance<DepsT, GlobalsT, CommandsT>,
  knownCommand: CliCommand<DepsT, ArgsDef, OptsDef>,
  parsed: ParseResult
): Promise<number> {
  const validated = validateCommand(parsed, knownCommand, cli.globals)
  if (validated.isErr()) {
    for (const error of validated.error) console.error(error)
    return EXIT_ERROR
  }

  const ctx: RunContext<DepsT> = {
    args: validated.value.args as Record<string, unknown>,
    opts: validated.value.opts as Record<string, unknown>,
    deps: cli.deps,
    raw: parsed
  }

  const globalMiddleware = cli.middleware as readonly Middleware<RunContext<DepsT>>[]
  const commandMiddleware = (knownCommand.middleware ?? []) as readonly Middleware<RunContext<DepsT>>[]
  const chain = [...globalMiddleware, ...commandMiddleware]

  try {
    await runChain(chain, ctx, async () => {
      await knownCommand.run(ctx)
    })
    return EXIT_OK
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Command "${knownCommand.name}" failed: ${message}`)
    return EXIT_ERROR
  }
}

export async function runCommand<
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef>[]
>(cli: CliInstance<DepsT, GlobalsT, CommandsT>, rawArgv: readonly string[] = Bun.argv): Promise<number> {
  const args = normalizeArgv(rawArgv)
  const parsed = parseArgv(rawArgv, cli.globals, cli.commands)
  const knownCommand = resolveCommand(cli, parsed)

  const earlyExit = handleHelpOrVersion(cli, args, knownCommand)
  if (earlyExit !== undefined) return earlyExit

  if (parsed.errors.length > 0 && !parsed.commandName) {
    for (const error of parsed.errors) console.error(error)
    return EXIT_ERROR
  }

  if (!parsed.commandName) return handleMissingCommand(cli, args)

  if (!knownCommand) {
    console.error(`Unknown command: ${parsed.commandName}`)
    return EXIT_ERROR
  }

  return await executeKnownCommand(cli, knownCommand, parsed)
}
