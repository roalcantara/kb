import type { CliInstance } from './with_cli.ts'
import type { CliCommand } from './with_command.ts'

function pad(value: string, width: number): string {
  return value.padEnd(width, ' ')
}

function formatOptionLines(options: Record<string, { short?: string; env?: string; default?: unknown }>): string[] {
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

export function printHelp(cli: CliInstance, commands: readonly CliCommand[] = cli.commands): void {
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

export function printCommandHelp(cli: CliInstance, command: CliCommand, name = command.name): void {
  const header = `${cli.name} ${cli.version} · ${cli.description}`
  const usage = `Usage: ${cli.name} ${name} [opts]`
  const localOptLines = formatOptionLines(command.opts ?? {})
  const argLines = Object.keys(command.args ?? {}).map(key => `  ${key}`)
  const output = [header, usage, '', `Command: ${command.desc}`]

  if (argLines.length > 0) output.push('', 'Args:', ...argLines)
  if (localOptLines.length > 0) output.push('', 'Options:', ...localOptLines)
  console.log(output.join('\n'))
}

export function printVersion(cli: CliInstance): void {
  console.log(`${cli.name} ${cli.version}`)
}
