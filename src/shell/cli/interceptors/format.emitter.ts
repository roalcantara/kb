import type { KliHandle } from '@kb/kli'
import type { OptsDef } from '@kli/core/cli'

const FORMAT_KEYS = ['pretty', 'json', 'yaml', 'raw'] as const
type FormatKey = (typeof FORMAT_KEYS)[number]

const f = {
  isFormatKey: (v: string): v is FormatKey => (FORMAT_KEYS as readonly string[]).includes(v),
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
      return Bun.YAML.stringify(value)
    }
  },
  stringify: <T>(value: T, format: FormatKey) => {
    if (format === 'json' || format === 'yaml') return JSON.stringify(value)
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

/** Bind format globals + emitter to a shell from {@link ../main.ts} or {@link ../main.headless.ts}. */
export const defineFormatEmitter = <DepsT extends Record<string, unknown>, GlobalsT extends OptsDef>(
  shell: KliHandle<DepsT, GlobalsT>
) =>
  shell.defineEmitter({
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
      const raw = globals.format
      if (!f.isFormatKey(raw)) {
        console.error(`Invalid --format: ${String(raw)} (expected ${FORMAT_KEYS.join('|')})`)
        return
      }
      const formatted = formatPayload(raw, output)
      console.log(formatted)
    }
  })
