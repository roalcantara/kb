import { shell } from '../main.ts'

type FormatKey = 'pretty' | 'json' | 'yaml' | 'raw'

const f = {
  object: <T>(value: T, format: FormatKey) => {
    if (format === 'json') {
      return JSON.stringify(value, null, 2)
    }
    if (format === 'raw' || format === 'pretty') {
      return Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${k}\t${typeof v === 'object' ? Bun.JSON5.stringify(v) : String(v)}`)
        .join('\n')
    }
    if (format === 'yaml') {
      return Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${Bun.YAML.stringify(v)}`)
        .join('\n')
    }
  },
  stringify: <T>(value: T, format: FormatKey) => {
    if (format === 'json') return JSON.stringify(value)
    if (format === 'pretty') return JSON.stringify(value, null, 2)
    return value
  }
}
const formatPayload = <T>(format: FormatKey, result: T) => {
  if (typeof result === 'string') {
    return f.stringify(result, format)
  }
  if (result !== null && typeof result === 'object' && !Array.isArray(result)) {
    return f.object(result, format)
  }
  return f.stringify(result, format)
}

export const formatEmitter = shell.defineEmitter({
  globals: {
    format: {
      type: 'string',
      either: { p: 'pretty', j: 'json', y: 'yaml', r: 'raw' },
      default: 'raw',
      desc: 'Output format'
    }
  },
  run: (output, { globals }) => {
    if (output === undefined) return
    const value = globals.format as FormatKey
    const formatted = formatPayload(value, output)
    console.log(formatted)
  }
})
