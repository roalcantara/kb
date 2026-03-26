import type { GreeterInput } from './greeter_input'
import pkg from './package.json'
import { assertGreeterInput } from './tools/typia/generated/assert_greeter_input'

export type { GreeterInput } from './greeter_input'

export const greet = (input: GreeterInput) => {
  assertGreeterInput(input)
  const { name, times = 1 } = input
  return Array.from({ length: times }, () => `Hello "${name}" via Bun!`).join('\n\n')
}

const help = `
${pkg.description}

Usage:
  kb <command> [options]

Options:
  -h, --help     Show help (default: false)

Commands:
  greet [name]   Greet someone (default name: World)

v${pkg.version}
` as const

const PATH_SEP = /[/\\]/

function cliArgs(): string[] {
  const args = Bun.argv.slice(2)
  const scriptName = Bun.argv[1]?.split(PATH_SEP).pop()
  let i = 0
  while (scriptName && args[i] === scriptName) i += 1
  return args.slice(i)
}

function runCli() {
  const args = cliArgs()
  const first = args[0]

  if (first === '-h' || first === '--help') {
    console.log(help.trim())
    return
  }

  if (first === 'greet') {
    console.log(greet({ name: args[1] ?? 'World' }))
    return
  }

  if (first === undefined) {
    console.log(greet({ name: 'World' }))
    return
  }

  console.error(`Unknown command: ${first}`)
  console.log(help.trim())
  process.exitCode = 1
}

if (import.meta.main) runCli()
