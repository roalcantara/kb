import { runCommand } from '@kb/kli'
import { buildAppCli } from './cli_kit.ts'
import { greetCommand, infoCommand } from './commands'

const commands = [infoCommand, greetCommand] as const
const cli = buildAppCli(commands)

export function runCli(rawArgv: readonly string[]): Promise<number> {
  return runCommand(cli, rawArgv)
}
