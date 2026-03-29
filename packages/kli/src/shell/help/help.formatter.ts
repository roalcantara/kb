import type { CliCommand } from '../../core/commands/command_handler.schema.ts'
import type { ArgsDef, OptDef, OptsDef } from '../../core/parsing/argv.schema.ts'
import type { CliInstance } from '../factories/cli_instance.factory.ts'

/** Right-pads `value` to `width` for aligned CLI columns. */
const pad = (value: string, width: number): string => value.padEnd(width, ' ')

type OptRow = { left: string; right: string }

const metaSuffix = (def: OptDef): string => {
  const meta: string[] = []
  if (def.default !== undefined) meta.push(`default=${String(def.default)}`)
  if (def.env) meta.push(`env=${def.env}`)
  return meta.length > 0 ? `(${meta.join(', ')})` : ''
}

const plainOptionRow = (name: string, def: OptDef): OptRow => {
  const short = def.short ? `-${def.short}, ` : '    '
  const left = `${short}--${name}`
  const metaStr = metaSuffix(def)
  let right = ''
  if (def.desc && metaStr) right = `${def.desc} ${metaStr}`
  else if (def.desc) right = def.desc
  else if (metaStr) right = metaStr
  return { left, right }
}

const eitherRowsForDef = (def: OptDef): OptRow[] => {
  const either = def.either
  if (!either || Object.keys(either).length === 0) return []
  const rows: OptRow[] = []
  let firstEither = true
  for (const [shortLetter, longValue] of Object.entries(either)) {
    const left = `-${shortLetter}, --${longValue}`
    const body = def.desc ? `${def.desc} (\`${longValue}\`)` : String(longValue)
    const trail: string[] = []
    if (def.default === longValue) trail.push('(default)')
    if (def.env && firstEither) trail.push(`env=${def.env}`)
    firstEither = false
    const right = trail.length > 0 ? `${body} ${trail.join(' ')}` : body
    rows.push({ left, right })
  }
  return rows
}

/**
 * One row per flag variant: either-group opts expand to `-s, --value` lines; plain opts stay `--name`.
 */
const buildOptionRows = (options: OptsDef): OptRow[] => {
  const rows: OptRow[] = []
  for (const [name, def] of Object.entries(options)) {
    const eitherRows = eitherRowsForDef(def)
    if (eitherRows.length > 0) rows.push(...eitherRows)
    else rows.push(plainOptionRow(name, def))
  }
  return rows
}

/**
 * Builds indented lines for option help (`--name`, `either` expansion, `desc`, defaults, env).
 *
 * @param options - Opt schema map from {@link OptsDef}
 * @returns Lines without trailing newlines (caller joins)
 */
const formatOptionLines = (options: OptsDef): string[] => {
  const rows = buildOptionRows(options)
  if (rows.length === 0) return []
  const leftWidth = Math.max(...rows.map(r => r.left.length))
  return rows.map(({ left, right }) =>
    right.length > 0 ? `  ${pad(left, leftWidth)}  ${right}` : `  ${pad(left, leftWidth)}`
  )
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
