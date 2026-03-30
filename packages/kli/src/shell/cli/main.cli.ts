import {
  type ArgsDef,
  type CliCommand,
  type CliInterceptor,
  type CliMiddlewareContext,
  type Middleware,
  normalizeArgv,
  type OptsDef,
  type ParseResult,
  parseArgv,
  validateCommand
} from '@kli/core/cli'
import type { TuiRoot } from '@kli/shell/tui'
import { runChain, runInterceptorChain } from './dispatch'
import type { CliInstance } from './factories'
import { printCommandHelp, printHelp, printVersion } from './help'

/** Inlined by `build:prod` via `--define KB_HEADLESS_BUILD=true` (Docker / minified compile). */
declare const KB_HEADLESS_BUILD: boolean | undefined

const EXIT_OK = 0
const EXIT_ERROR = 1
const HELP_SHORT = '-h'
const HELP_LONG = '--help'
const VERSION_LONG = '--version'

type RunContext<DepsT, GlobalsT extends OptsDef> = CliMiddlewareContext<DepsT, GlobalsT> & { raw: ParseResult }

/** First argv token that is not a flag (used to detect unknown subcommands). */
const firstNonFlag = (args: readonly string[]): string | undefined => args.find(arg => !arg.startsWith('-'))

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
 * No subcommand: error on stray token; if `cli.tui` is set and stdout is a TTY, OpenTUI mount; else root help.
 * When `tui` was not passed to `createKli` / `setup({ tui })`, behavior is plain CLI (help) even on a TTY.
 *
 * @returns Process exit code
 */
const handleMissingCommand = async <
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]
>(
  cli: CliInstance<DepsT, GlobalsT, CommandsT>,
  args: readonly string[],
  parsed: ParseResult
): Promise<number> => {
  const unknownCommand = firstNonFlag(args)
  if (unknownCommand) {
    console.error(`Unknown command: ${unknownCommand}`)
    return EXIT_ERROR
  }
  const kbHeadlessCompile = typeof KB_HEADLESS_BUILD !== 'undefined' && KB_HEADLESS_BUILD === true
  if (!kbHeadlessCompile && process.stdout.isTTY === true && cli.tui !== undefined) {
    const { startTui } = await import('../tui/main.tui.ts')
    return await startTui(cli.tui as TuiRoot, cli, parsed)
  }
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

  if (!parsed.commandName) return await handleMissingCommand(cli, args, parsed)

  if (!knownCommand) {
    console.error(`Unknown command: ${parsed.commandName}`)
    return EXIT_ERROR
  }

  return await executeKnownCommand(cli, knownCommand, parsed)
}
