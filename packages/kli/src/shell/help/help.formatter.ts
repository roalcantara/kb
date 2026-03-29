import type { CliCommand } from '../../core/commands/command_handler.schema.ts'
import type { ArgsDef, OptsDef } from '../../core/parsing/argv.schema.ts'
import type { CliInstance } from '../factories/cli_instance.factory.ts'

/** Right-pads `value` to `width` for aligned CLI columns. */
const pad = (value: string, width: number): string => value.padEnd(width, ' ')

/**
 * Builds indented lines for option help (`--name`, short flag, env, default hints).
 *
 * @param options - Opt schema map (`short`, `env`, `default` shown when set)
 * @returns Lines without trailing newlines (caller joins)
 */
const formatOptionLines = (options: Record<string, { short?: string; env?: string; default?: unknown }>): string[] => {
  const entries = Object.entries(options)
  if (entries.length === 0) return []

  const leftValues = entries.map(([name, def]) => {
    const short = def.short ? `-${def.short}, ` : '    '
    return `${short}--${name}`
  })
  const leftWidth = Math.max(...leftValues.map(value => value.length))

  return entries.map(([name, def], idx) => {
    const left = pad(leftValues[idx] ?? `--${name}`, leftWidth)
    const parts: string[] = []
    if (def.default !== undefined) parts.push(`default=${String(def.default)}`)
    if (def.env) parts.push(`env=${def.env}`)
    const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : ''
    return `  ${left}${suffix}`
  })
}

/**
 * Prints the root help listing: header, usage, commands, and global options.
 *
 * @param cli - CLI instance (name, version, globals, commands)
 * @param commands - Subset to list (defaults to `cli.commands`)
 *
 * @example
 * printHelp(cli)
 */
export const printHelp = <
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]
>(
  cli: CliInstance<DepsT, GlobalsT, CommandsT>,
  commands: readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[] = cli.commands
): void => {
  const header = `${cli.name} ${cli.version} · ${cli.description}`
  const usage = `Usage: ${cli.name} <command> [opts]`
  const commandWidth = Math.max(0, ...commands.map(command => command.name.length))
  const commandLines = commands.map(command => `  ${pad(command.name, commandWidth)}  ${command.desc}`)
  const globalOptLines = formatOptionLines(cli.globals)
  const output = [header, usage, '', 'Commands:', ...commandLines]
  if (globalOptLines.length > 0) {
    output.push('', 'Global Options:', ...globalOptLines)
  }
  console.log(output.join('\n'))
}

/**
 * Prints help for a single command: usage, args, and local options.
 *
 * @param cli - CLI instance (for name/version in header)
 * @param command - Command whose schema is summarized
 * @param name - Override printed command name (defaults to `command.name`)
 *
 * @example
 * printCommandHelp(cli, myCmd)
 */
export const printCommandHelp = <
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]
>(
  cli: CliInstance<DepsT, GlobalsT, CommandsT>,
  command: CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>,
  name = command.name
): void => {
  const header = `${cli.name} ${cli.version} · ${cli.description}`
  const usage = `Usage: ${cli.name} ${name} [opts]`
  const localOptLines = formatOptionLines(command.opts ?? {})
  const argLines = Object.keys(command.args ?? {}).map(key => `  ${key}`)
  const output = [header, usage, '', `Command: ${command.desc}`]

  if (argLines.length > 0) output.push('', 'Args:', ...argLines)
  if (localOptLines.length > 0) output.push('', 'Options:', ...localOptLines)
  console.log(output.join('\n'))
}

/**
 * Prints `name version` on one line (for `--version`).
 *
 * @param cli - CLI instance
 *
 * @example
 * printVersion(cli)
 */
export const printVersion = <
  DepsT,
  GlobalsT extends OptsDef,
  CommandsT extends readonly CliCommand<DepsT, ArgsDef, OptsDef, GlobalsT>[]
>(
  cli: CliInstance<DepsT, GlobalsT, CommandsT>
): void => {
  console.log(`${cli.name} ${cli.version}`)
}
