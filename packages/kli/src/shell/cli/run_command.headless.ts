import { handleMissingCommandHeadless } from './commands/headless.command.ts'
import { makeRunCommand } from './run_command.impl.ts'

/**
 * Dispatch without any OpenTUI / `interactive.command` module — used by compiled headless
 * binaries so `bun build --compile --target=…` never pulls `@opentui/*`.
 */
export const runCommand = makeRunCommand(async (cli, args, parsed) => handleMissingCommandHeadless(cli, args, parsed))
