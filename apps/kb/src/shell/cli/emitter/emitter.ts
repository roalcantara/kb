import type { Format } from './formats'

const JSON_INDENT = 2
const COL_SEPARATOR = '  '
const FALLBACK_WIDTH = 0

type Formatter = (payload: unknown) => string

const pad = (value: string, width: number): string => value.padEnd(width)

const computeWidths = (keys: string[], records: Record<string, unknown>[]): number[] =>
  keys.map(key => Math.max(key.length, ...records.map(r => String(r[key] ?? '').length)))

const toRow = (record: Record<string, unknown>, keys: string[], widths: number[]): string =>
  keys.map((key, i) => pad(String(record[key] ?? ''), widths[i] ?? FALLBACK_WIDTH)).join(COL_SEPARATOR)

const prettyArray = (records: Record<string, unknown>[]): string => {
  if (records.length === 0) return ''
  const keys = Object.keys(records[0] ?? {})
  const widths = computeWidths(keys, records)
  const header = keys.map((k, i) => pad(k, widths[i] ?? FALLBACK_WIDTH)).join(COL_SEPARATOR)
  const rows = records.map(r => toRow(r, keys, widths))
  return [header, ...rows].join('\n')
}

const prettyObject = (record: Record<string, unknown>): string => {
  const keys = Object.keys(record)
  const maxKeyWidth = Math.max(...keys.map(k => k.length))
  return keys.map(k => `${pad(k, maxKeyWidth)}${COL_SEPARATOR}${String(record[k] ?? '')}`).join('\n')
}

const prettyFormat = (payload: unknown): string => {
  if (Array.isArray(payload)) return prettyArray(payload as Record<string, unknown>[])
  if (payload !== null && typeof payload === 'object') return prettyObject(payload as Record<string, unknown>)
  return String(payload ?? '')
}

const rawItem = (item: unknown): string =>
  item !== null && typeof item === 'object'
    ? Object.values(item as Record<string, unknown>)
        .map(v => String(v ?? ''))
        .join('\t')
    : String(item ?? '')

const rawFormat = (payload: unknown): string => {
  if (Array.isArray(payload)) return payload.map(rawItem).join('\n')
  if (payload !== null && typeof payload === 'object') {
    return Object.values(payload as Record<string, unknown>)
      .map(v => String(v ?? ''))
      .join('\t')
  }
  return String(payload ?? '')
}

const formatters: Record<Format, Formatter> = {
  json: payload => JSON.stringify(payload, null, JSON_INDENT),
  raw: rawFormat,
  pretty: prettyFormat
}

/** Pure: formats payload to a string. Use in tests to verify output without mocking console. */
export const formatPayload = (payload: unknown, format: Format): string => formatters[format](payload)

/** Imperative shell: formats and writes payload to stdout. The only place in shell that calls console.log for data. */
export const formatAndWrite = (payload: unknown, format: Format): void => {
  console.log(formatPayload(payload, format))
}
