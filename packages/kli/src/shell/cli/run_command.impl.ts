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
import { runChain, runInterceptorChain } from './dispatch'
import type { CliInstance } from './factories/cli_instance.factory.ts'
import { printCommandHelp, printHelp, printVersion } from './help'

const EXIT_OK = 0
const EXIT_ERROR = 1
const HELP_SHORT = '-h'
const HELP_LONG = '--help'
const VERSION_LONG = '--version'

type RunContext<DepsT, GlobalsT extends OptsDef> = CliMiddlewareContext<DepsT, GlobalsT> & { raw: ParseResult }

export type HandleMissingCommandFn = (cli: CliInstance, args: readonly string[], parsed: ParseResult) => Promise<number>

/** `makeRunCommand` product — used by {@link ./create_kli_handle.factory.ts}. */
export type RunCommand = <
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]
>(
  cli: CliInstance<DepsT, GlobalsT, CommandsT>,
  rawArgv?: readonly string[]
) => Promise<number>

type ResolveCommand = <
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]
>(
  cli: CliInstance<DepsT, GlobalsT, CommandsT>,
  parsed: ParseResult
) => CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT> | undefined

const resolveCommand: ResolveCommand = (cli, parsed) => {
  if (!parsed.commandName) return
  return cli.commands.find(command => command.name === parsed.commandName)
}

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
 * Shared argv → dispatch implementation; pass {@link HandleMissingCommandFn} for headless vs full CLI.
 */
export const makeRunCommand =
  (handleMissingCommand: HandleMissingCommandFn) =>
  async <DepsT, GlobalsT extends OptsDef, CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]>(
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

    if (!parsed.commandName) {
      return await handleMissingCommand(cli as CliInstance, args, parsed)
    }

    if (!knownCommand) {
      console.error(`Unknown command: ${parsed.commandName}`)
      return EXIT_ERROR
    }

    return await executeKnownCommand(cli, knownCommand, parsed)
  }
