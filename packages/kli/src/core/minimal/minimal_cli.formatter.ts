import type { MinimalCliConfig } from './minimal_cli.schema.ts'

const FLAG_HELP_SHORT = '-h'
const FLAG_HELP_LONG = '--help'

export { FLAG_HELP_LONG, FLAG_HELP_SHORT }

/**
 * Renders a fixed-layout help string for a minimal multi-command CLI.
 *
 * @param config - Program metadata and command summaries
 * @returns Trimmed help text suitable for `console.log`
 *
 * @example
 * formatHelp({ programName: 'demo', description: 'Demo', version: '1', commands: [] })
 */
export const formatHelp = (config: MinimalCliConfig): string => {
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
