import { debugLog } from '@kb/core'
import type { KliHandle, OptsDef } from '@kb/kli/headless'

export const defineViewCommand = <DepsT extends Record<string, unknown>, GlobalsT extends OptsDef>(
  shell: KliHandle<DepsT, GlobalsT>
) =>
  shell.withCmd({
    name: 'view',
    desc: 'Show a single entry by stable id',
    args: {
      id: { type: 'string', required: true }
    },
    opts: {},
    run: ({ args, globals }) => {
      const dbg = globals.debug === true
      if (dbg) {
        debugLog(true, 'sqlite', { label: 'view_stub', id: args.id })
      }
      return {
        command: 'view',
        id: args.id,
        entry: null,
        status: 'stub',
        message: 'Repository findById not yet implemented'
      }
    }
  })
