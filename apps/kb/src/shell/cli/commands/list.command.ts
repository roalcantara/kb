import type { KliHandle, OptsDef } from '@kb/kli/headless'
import { debugLog } from '../../logging/debug_log.ts'
import { lsQueryCache } from '../../state/ls_query_cache.ts'

const DEFAULT_LIMIT = 50
const DEFAULT_OFFSET = 0
const DEBUG_KEY_MAX_LEN = 48

const cacheKey = (parts: Record<string, string | number>): string => JSON.stringify(parts)

const queryParts = (
  args: { query?: string | string[] },
  tags: string | undefined,
  types: string | undefined,
  limit: number | undefined,
  offset: number | undefined
): Record<string, string | number> => {
  const queryArr = Array.isArray(args.query) ? args.query : []
  return {
    q: queryArr.join(' '),
    tags: String(tags ?? ''),
    types: String(types ?? ''),
    limit: Number(limit ?? DEFAULT_LIMIT),
    offset: Number(offset ?? DEFAULT_OFFSET)
  }
}

const logListDebug = (dbg: boolean, key: string, t0: number, cached: unknown): void => {
  if (!dbg) return
  if (cached === undefined) {
    debugLog(true, 'cache_miss', { label: 'ls', key: key.slice(0, DEBUG_KEY_MAX_LEN) })
    debugLog(true, 'sqlite', { label: 'ls_stub', dur_ms: Math.round(performance.now() - t0) })
  } else {
    debugLog(true, 'cache_hit', { label: 'ls', dur_ms: Math.round(performance.now() - t0) })
  }
}

export const defineListCommand = <DepsT extends Record<string, unknown>, GlobalsT extends OptsDef>(
  shell: KliHandle<DepsT, GlobalsT>
) =>
  shell.withCmd({
    name: 'ls',
    desc: 'List or search knowledge entries (FTS + filters)',
    args: {
      'query...': { type: 'string' }
    },
    opts: {
      tags: {
        type: 'string',
        desc: 'Comma-separated tags (AND). KLI has no repeatable --tag yet.'
      },
      types: { type: 'string', desc: 'Comma-separated entry types (e.g. command,cheat)' },
      limit: { type: 'number', default: DEFAULT_LIMIT, desc: 'Max rows' },
      offset: { type: 'number', default: DEFAULT_OFFSET, desc: 'Skip rows' }
    },
    run: ({ args, globals, opts }) => {
      const queryJoined = (Array.isArray(args.query) ? args.query : []).join(' ')
      const dbg = globals.debug === true
      const parts = queryParts(args, opts.tags, opts.types, opts.limit, opts.offset)
      const key = cacheKey(parts)
      const t0 = performance.now()
      const cached = lsQueryCache.get(key)
      if (cached === undefined) {
        lsQueryCache.set(key, [])
      }
      logListDebug(dbg, key, t0, cached)
      return {
        command: 'ls',
        query: queryJoined,
        tags: opts.tags ?? '',
        types: opts.types ?? '',
        limit: opts.limit ?? DEFAULT_LIMIT,
        offset: opts.offset ?? DEFAULT_OFFSET,
        rows: [],
        rowCount: 0,
        status: 'stub',
        message: 'Listing not yet wired to SQLite — cache semantics demonstrated when --debug'
      }
    }
  })
