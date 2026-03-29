import type {
  CliCommand,
  CliInterceptor,
  CliMiddlewareContext,
  Middleware
} from '../../core/commands/command_handler.schema.ts'
import type { ArgsDef, OptsDef, ParseResult } from '../../core/parsing/argv.schema.ts'
import { normalizeArgv } from '../../core/parsing/argv_normalize.util.ts'
import { parseArgv } from '../../core/parsing/argv_parse.service.ts'
import { validateCommand } from '../../core/validation/validate_command.service.ts'
import type { CliInstance } from '../factories/cli_instance.factory.ts'
import { printCommandHelp, printHelp, printVersion } from '../help/help.formatter.ts'
import { runInterceptorChain } from './interceptor_chain.service.ts'
import { runChain } from './middleware_chain.service.ts'

const EXIT_OK = 0
const EXIT_ERROR = 1
const HELP_SHORT = '-h'
const HELP_LONG = '--help'
const VERSION_LONG = '--version'

type RunContext<DepsT, GlobalsT extends OptsDef> = CliMiddlewareContext<DepsT, GlobalsT> & { raw: ParseResult }

/** First argv token that is not a flag (used to detect unknown subcommands). */
const firstNonFlag = (args: readonly string[]): string | undefined => args.find(arg => !arg.startsWith('-'))

/** Placeholder until real TUI wiring exists. */
const startTuiStub = (): number => {
  console.log('TUI phase 2')
  return EXIT_OK
}

/** Looks up the command object for `parsed.commandName`, if any. */
const resolveCommand = <
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]
>(
  cli: CliInstance<DepsT, GlobalsT, CommandsT>,
  parsed: ParseResult
): CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT> | undefined => {
  if (!parsed.commandName) return
  return cli.commands.find(command => command.name === parsed.commandName)
}

/**
 * Handles `--help` / `-h` / `--version` before dispatch.
 *
 * @returns Exit code when handled, or `undefined` to continue normal dispatch
 */
const handleHelpOrVersion = <
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]
>(
  cli: CliInstance<DepsT, GlobalsT, CommandsT>,
  args: readonly string[],
  knownCommand: CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT> | undefined
): number | undefined => {
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

/**
 * No subcommand: error on stray token, stub TUI when TTY+tui, else root help.
 *
 * @returns Process exit code
 */
const handleMissingCommand = <
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]
>(
  cli: CliInstance<DepsT, GlobalsT, CommandsT>,
  args: readonly string[]
): number => {
  const unknownCommand = firstNonFlag(args)
  if (unknownCommand) {
    console.error(`Unknown command: ${unknownCommand}`)
    return EXIT_ERROR
  }
  if (process.stdout.isTTY && cli.tui) return startTuiStub()
  printHelp(cli, cli.commands)
  return EXIT_OK
}

/**
 * Validates argv for `knownCommand`, builds handler context, runs middleware chain, then `run`.
 *
 * @returns Exit code from handler or middleware errors
 */
const executeKnownCommand = async <
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]
>(
  cli: CliInstance<DepsT, GlobalsT, CommandsT>,
  knownCommand: CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>,
  parsed: ParseResult
): Promise<number> => {
  const validated = validateCommand(parsed, knownCommand, cli.globals)
  if (validated.isErr()) {
    for (const error of validated.error) console.error(error)
    return EXIT_ERROR
  }

  const ctx: RunContext<DepsT, GlobalsT> = {
    args: validated.value.args,
    opts: validated.value.opts,
    globals: validated.value.globals,
    deps: cli.deps,
    raw: parsed
  }

  const globalMiddleware = cli.middleware as readonly Middleware<RunContext<DepsT, GlobalsT>>[]
  const commandMiddleware = (knownCommand.middleware ?? []) as readonly Middleware<RunContext<DepsT, GlobalsT>>[]
  const chain = [...globalMiddleware, ...commandMiddleware]

  try {
    await runChain(chain, ctx, async () => {
      const globalInterceptors = cli.interceptors
      const commandInterceptors = knownCommand.interceptors ?? []
      const interceptors = [
        cli.emitterInterceptor as CliInterceptor<RunContext<DepsT, GlobalsT>>,
        ...globalInterceptors,
        ...commandInterceptors
      ]
      await runInterceptorChain(interceptors, ctx, () =>
        Promise.resolve(knownCommand.run(ctx as Parameters<(typeof knownCommand)['run']>[0]))
      )
    })
    return EXIT_OK
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Command "${knownCommand.name}" failed: ${message}`)
    return EXIT_ERROR
  }
}

/**
 * Full CLI dispatch: parse argv, help/version, validate, middleware, command handler.
 *
 * @param cli - Built instance from {@link withCli}
 * @param rawArgv - Defaults to `Bun.argv`
 * @returns Process exit code
 *
 * @example
 * await runCommand(cli)
 * await runCommand(cli, ['bun', 'app.ts', 'info'])
 */
export const runCommand = async <
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]
>(
  cli: CliInstance<DepsT, GlobalsT, CommandsT>,
  rawArgv: readonly string[] = Bun.argv
): Promise<number> => {
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
