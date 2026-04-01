import type { ParseResult } from '@kli/core/cli'
import type { CliInstance } from '../factories/cli_instance.factory.ts'
import { printHelp } from '../help'
import { firstNonFlag } from './command.helpers.ts'

const EXIT_OK = 0
const EXIT_ERROR = 1

/**
 * No subcommand: unknown token → error; else root help. Used when
 * {@link KB_HEADLESS_BUILD} is true so the compiled binary never pulls OpenTUI.
 */
export const handleMissingCommandHeadless = (
  cli: CliInstance,
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
