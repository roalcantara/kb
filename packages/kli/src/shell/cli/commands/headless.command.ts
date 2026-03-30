import type { ArgsDef, CliCommand, OptsDef, ParseResult } from '@kli/core/cli'
import type { CliInstance } from '../factories/cli_instance.factory.ts'
import { printHelp } from '../help'
import { firstNonFlag } from './first_non_flag.util.ts'

const EXIT_OK = 0
const EXIT_ERROR = 1

/**
 * No subcommand: unknown token → error; else root help. Used when
 * {@link KB_HEADLESS_BUILD} is true so the compiled binary never pulls OpenTUI.
 */
export const handleMissingCommandHeadless = <
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]
>(
  cli: CliInstance<DepsT, GlobalsT, CommandsT>,
  args: readonly string[],
  _parsed: ParseResult
): number => {
  const unknownCommand = firstNonFlag(args)
  if (unknownCommand) {
    console.error(`Unknown command: ${unknownCommand}`)
    return EXIT_ERROR
  }
  printHelp(cli, cli.commands)
  return EXIT_OK
}
