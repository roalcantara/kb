import { handleMissingCommandHeadless } from './commands/headless.command.ts'
import { type HandleMissingCommandFn, makeRunCommand } from './run_command.impl.ts'

/** Inlined by `build:prod` via `--define KB_HEADLESS_BUILD=true` (Docker / minified compile). */
declare const KB_HEADLESS_BUILD: boolean | undefined

const handleMissingCommand: HandleMissingCommandFn = async (cli, args, parsed) => {
  if (typeof KB_HEADLESS_BUILD !== 'undefined' && KB_HEADLESS_BUILD === true) {
    return handleMissingCommandHeadless(cli, args, parsed)
  }
  const { handleMissingCommandInteractive } = await import('./commands/interactive.command.ts')
  return handleMissingCommandInteractive(cli, args, parsed)
}

/**
 * Full CLI dispatch (dev / tests): TTY + `cli.tui` may load OpenTUI via
 * {@link ./commands/interactive.command.ts}.
 */
export const runCommand = makeRunCommand(handleMissingCommand)
