import { runCommand, withCli, withCommand } from '@kb/kli'

import pkg from '../../package.json'
import { infoCommand } from './commands/info.command.ts'
import type { AppDeps } from './deps.factory.ts'
import { buildDeps } from './deps.factory.ts'

const DEFAULT_GREET_NAME = 'World'

const greetCommand = withCommand<AppDeps>({
  name: 'greet',
  desc: 'Greet someone',
  args: {
    name: { type: 'string', required: false }
  },
  run: ({ args, deps }) => {
    const typedArgs = args as { name?: string }
    console.log(deps.greeter({ name: typedArgs.name ?? DEFAULT_GREET_NAME }))
  }
})

const commands = [infoCommand, greetCommand] as const

const cli = withCli<AppDeps, Record<string, never>, typeof commands>({
  name: 'kb',
  packageJson: pkg,
  deps: buildDeps(),
  commands
})

export function runCli(rawArgv: readonly string[]): Promise<number> {
  return runCommand(cli, rawArgv)
}
