import type { ArgsDef, CliCommand, OptsDef, ParseResult } from '@kli/core/cli'
import type { TuiRoot } from '../../tui/main.tui.ts'
import type { CliInstance } from '../factories/cli_instance.factory.ts'
import { printHelp } from '../help'
import { firstNonFlag } from './first_non_flag.util.ts'

const EXIT_OK = 0
const EXIT_ERROR = 1

/**
 * No subcommand: TTY + `cli.tui` → OpenTUI; else root help. Kept in a separate
 * module so headless `bun build --compile` can tree-shake it when
 * `KB_HEADLESS_BUILD=true`.
 */
export const handleMissingCommandInteractive = async <
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
  if (process.stdout.isTTY === true && cli.tui !== undefined) {
    const { startTui } = await import('../../tui/main.tui.ts')
    return await startTui(cli.tui as TuiRoot, cli, parsed)
  }
  printHelp(cli, cli.commands)
  return EXIT_OK
}
