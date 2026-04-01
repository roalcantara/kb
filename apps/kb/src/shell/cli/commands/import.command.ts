import type { KliHandle, OptsDef } from '@kb/kli/headless'
import { debugLog } from '../../logging/debug_log.ts'

export const defineImportCommand = <DepsT extends Record<string, unknown>, GlobalsT extends OptsDef>(
  shell: KliHandle<DepsT, GlobalsT>
) =>
  shell.withCmd({
    name: 'import',
    desc: 'Import YAML sources into the SQLite index',
    args: {},
    opts: {
      source: { type: 'string', desc: 'Override sources root (default: global --source / config)' }
    },
    run: ({ globals, opts }) => {
      const dbg = globals.debug === true
      const root = typeof opts.source === 'string' && opts.source.length > 0 ? opts.source : globals.source
      if (dbg) {
        debugLog(true, 'import', { root: String(root), stage: 'start' })
      }
      return {
        command: 'import',
        sourceRoot: root,
        filesProcessed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        status: 'stub',
        message: 'Import pipeline not yet implemented — wire parser + SQLite'
      }
    }
  })
