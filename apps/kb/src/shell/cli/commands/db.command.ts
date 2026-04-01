import type { KliHandle, OptsDef } from '@kb/kli/headless'
import { debugLog } from '../../logging/debug_log.ts'

export const defineDbCommand = <DepsT extends Record<string, unknown>, GlobalsT extends OptsDef>(
  shell: KliHandle<DepsT, GlobalsT>
) =>
  shell.withCmd({
    name: 'db',
    desc: 'Show database path and entry statistics',
    args: {},
    opts: {},
    run: ({ globals }) => {
      const dbg = globals.debug === true
      if (dbg) {
        debugLog(true, 'sqlite', { label: 'db_stats_stub', path: String(globals.db) })
      }
      return {
        command: 'db',
        dbPath: globals.db,
        countsByType: { Bookmark: 0, Command: 0, Cheat: 0, Task: 0 },
        totalEntries: 0,
        status: 'stub',
        message: 'Stats query not yet implemented'
      }
    }
  })
