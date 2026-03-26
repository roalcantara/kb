import { greeter } from '@core'
import { type MinimalCliConfig, runMinimalCli } from '@kb/kli'
import pkg from './package.json'

const DEFAULT_GREET_NAME = 'World'

const KB_CLI: MinimalCliConfig = {
  programName: 'kb',
  description: pkg.description,
  version: pkg.version,
  commands: [
    {
      name: 'greet',
      helpLine: `greet [name]   Greet someone (default name: ${DEFAULT_GREET_NAME})`,
      run: positionalArgs => {
        console.log(greeter({ name: positionalArgs[0] ?? DEFAULT_GREET_NAME }))
      }
    }
  ]
}

function main() {
  const code = runMinimalCli(KB_CLI, Bun.argv)
  if (code !== 0) process.exitCode = code
}

if (import.meta.main) main()
