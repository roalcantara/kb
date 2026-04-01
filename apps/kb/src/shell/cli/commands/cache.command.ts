import type { KliHandle, OptsDef } from '@kb/kli/headless'
import { debugLog } from '../../logging/debug_log.ts'
import { lsQueryCache } from '../../state/ls_query_cache.ts'

export const defineCacheCommand = <DepsT extends Record<string, unknown>, GlobalsT extends OptsDef>(
  shell: KliHandle<DepsT, GlobalsT>
) =>
  shell.withCmd({
    name: 'cache',
    desc: 'Show cache statistics or invalidate ls query cache',
    args: {},
    opts: {
      invalidate: { type: 'boolean' as const, desc: 'Clear in-memory ls query cache' }
    },
    run: ({ globals, opts }) => {
      const dbg = globals.debug === true
      if (opts.invalidate === true) {
        const before = lsQueryCache.size()
        lsQueryCache.clear()
        if (dbg) {
          debugLog(true, 'query', { action: 'invalidate', cleared: before })
        }
        return {
          command: 'cache',
          invalidated: true,
          entriesBefore: before,
          entriesAfter: lsQueryCache.size()
        }
      }
      return {
        command: 'cache',
        invalidated: false,
        lsQueryCacheEntries: lsQueryCache.size(),
        message: 'In-memory ls cache only (stub until full app cache)'
      }
    }
  })
