import { normalizeArgv } from '../parsing/argv_normalize.util.ts'
import { FLAG_HELP_LONG, FLAG_HELP_SHORT, formatHelp } from './minimal_cli.formatter.ts'
import type { MinimalCliConfig } from './minimal_cli.schema.ts'

const EXIT_OK = 0
const EXIT_ERROR = 1

/** @returns Whether `token` is `-h` or `--help` */
const isHelpFlag = (token: string | undefined): boolean => token === FLAG_HELP_SHORT || token === FLAG_HELP_LONG

/**
 * Tiny command dispatcher: prints help, routes first token to a command, or errors.
 *
 * @param config - Program and commands
 * @param rawArgv - Full argv including runtime and script
 * @returns Exit code `0` for success/help, `1` for unknown command
 *
 * @example
 * runMinimalCli(config, Bun.argv)
 */
export const runMinimalCli = (config: MinimalCliConfig, rawArgv: readonly string[]): number => {
  const args = normalizeArgv(rawArgv)
  const first = args[0]
  const help = formatHelp(config)

  if (first === undefined || isHelpFlag(first)) {
    console.log(help)
    return EXIT_OK
  }

  const command = config.commands.find(c => c.name === first)
  if (command) {
    command.run(args.slice(1))
    return EXIT_OK
  }

  console.error(`Unknown command: ${first}`)
  console.log(help)
  return EXIT_ERROR
}
