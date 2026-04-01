type DebugPhase = 'config_load' | 'config_reload' | 'cache_hit' | 'cache_miss' | 'sqlite' | 'import' | 'query'

type DebugScalar = string | number | boolean

const stringify = (v: DebugScalar): string => (typeof v === 'boolean' ? String(v) : String(v))

/**
 * Structured line to stderr (stdout stays clean for piping).
 *
 * Wire format (keys may vary by phase):
 * `ts=<ISO8601> phase=<phase> k=v ...`
 */
export const debugLog = (
  enabled: boolean,
  phase: DebugPhase,
  detail: Record<string, DebugScalar | undefined>
): void => {
  if (!enabled) return
  const parts = [`ts=${new Date().toISOString()}`, `phase=${phase}`]
  for (const [k, v] of Object.entries(detail)) {
    if (v === undefined) continue
    parts.push(`${k}=${stringify(v)}`)
  }
  console.error(parts.join(' '))
}
