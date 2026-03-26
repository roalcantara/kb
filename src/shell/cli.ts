import { type MinimalCliConfig, runMinimalCli, withCli, withCommand } from '@kb/kli'

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

function toMinimalCliConfig(): MinimalCliConfig {
  return {
    programName: cli.name,
    description: cli.description,
    version: cli.version,
    commands: cli.commands.map(command => ({
      name: command.name,
      helpLine: `${command.name}   ${command.desc}`,
      run: positionalArgs => {
        const args = positionalArgs[0] ? { name: positionalArgs[0] } : {}
        return command.run({ args, opts: {}, deps: cli.deps })
      }
    }))
  }
}

export function runCli(rawArgv: readonly string[]): number {
  return runMinimalCli(toMinimalCliConfig(), rawArgv)
}
