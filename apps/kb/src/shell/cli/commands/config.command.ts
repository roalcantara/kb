import type { KliHandle, OptsDef } from '@kb/kli/headless'
import { debugLog } from '../../logging/debug_log.ts'

export const defineConfigCommand = <DepsT extends Record<string, unknown>, GlobalsT extends OptsDef>(
  shell: KliHandle<DepsT, GlobalsT>
) =>
  shell.withCmd({
    name: 'config',
    desc: 'Show or initialize KodexB configuration',
    args: {},
    opts: {
      setup: { type: 'boolean' as const, desc: 'Create default config, database path, and sources directory' },
      sync: { type: 'boolean' as const, desc: 'Reload configuration from disk (drop in-process cache)' }
    },
    run: ({ globals, opts }) => {
      const dbg = globals.debug === true
      if (dbg) {
        debugLog(true, 'config_load', { setup: opts.setup === true, sync: opts.sync === true })
      }
      if (opts.sync === true && dbg) {
        debugLog(true, 'config_reload', { note: 'stub' })
      }
      return {
        command: 'config',
        configPath: globals.config,
        sourcePath: globals.source,
        dbPath: globals.db,
        setupRequested: opts.setup === true,
        syncRequested: opts.sync === true,
        status: 'stub',
        message:
          opts.setup === true
            ? 'Setup: create dirs + default config (not yet implemented)'
            : opts.sync === true
              ? 'Sync: clear config cache (not yet implemented)'
              : 'Resolved paths from globals'
      }
    }
  })
