/** Phases emitted when `-d` / `--debug` or per-command debug is enabled. */
type DebugPhase = 'config_load' | 'config_reload' | 'cache_hit' | 'cache_miss' | 'sqlite' | 'import' | 'query'

const stringify = (v: string | number | boolean): string => (typeof v === 'boolean' ? String(v) : String(v))

/** Rails-style structured line to stderr (stdout stays clean for piping). */
export const debugLog = (
  enabled: boolean,
  phase: DebugPhase,
  detail: Record<string, string | number | boolean | undefined>
): void => {
  if (!enabled) return
  const parts = [`phase=${phase}`]
  for (const [k, v] of Object.entries(detail)) {
    if (v === undefined) continue
    parts.push(`${k}=${stringify(v)}`)
  }
  console.error(`[kb-debug] ${parts.join(' ')}`)
}
