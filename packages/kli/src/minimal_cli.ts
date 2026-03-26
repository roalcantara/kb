/**
 * Generic CLI runner only: consumers supply program name, metadata, and commands.
 * No imports from any application or domain.
 */
const PATH_SEPARATOR = /[/\\]/
const EXIT_OK = 0
const EXIT_ERROR = 1
const FLAG_HELP_SHORT = '-h'
const FLAG_HELP_LONG = '--help'

export type CliCommandDefinition = {
  /** First argv token that selects this command */
  name: string
  /** Single line in the Commands section (leading spaces added by the formatter) */
  helpLine: string
  /** Positional args after the command name */
  run: (positionalArgs: readonly string[]) => void
}

export type MinimalCliConfig = {
  /** Shown in Usage, e.g. binary or script name */
  programName: string
  description: string
  version: string
  commands: readonly CliCommandDefinition[]
}

export function formatHelp(config: MinimalCliConfig): string {
  const commandBlock = config.commands.map(c => `  ${c.helpLine}`).join('\n')
  return `
${config.description}

Usage:
  ${config.programName} <command> [options]

Options:
  ${FLAG_HELP_SHORT}, ${FLAG_HELP_LONG}     Show help

Commands:
${commandBlock}

v${config.version}
`.trim()
}

export function normalizeArgv(raw: readonly string[]): string[] {
  const args = raw.slice(2)
  const scriptName = raw[1]?.split(PATH_SEPARATOR).pop()
  let i = 0
  while (scriptName && args[i] === scriptName) i += 1
  return args.slice(i)
}

function isHelpFlag(token: string | undefined): boolean {
  return token === FLAG_HELP_SHORT || token === FLAG_HELP_LONG
}

export function runMinimalCli(config: MinimalCliConfig, rawArgv: readonly string[]): number {
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
