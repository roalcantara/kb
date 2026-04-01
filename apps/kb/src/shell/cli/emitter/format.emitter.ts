import type { KliHandle } from '@kb/kli'
import type { OptsDef } from '@kli/core/cli'

import { formatAndWrite } from './emitter.ts'
import { FORMATS, type Format } from './formats.ts'

const isFormat = (v: string): v is Format => (FORMATS as readonly string[]).includes(v)

/** Bind format globals + emitter; delegates formatting to {@link formatAndWrite}. */
export const defineFormatEmitter = <DepsT extends Record<string, unknown>, GlobalsT extends OptsDef>(
  shell: KliHandle<DepsT, GlobalsT>
) =>
  shell.defineEmitter({
    globals: {
      format: {
        type: 'string',
        either: { p: 'pretty', j: 'json', r: 'raw' },
        default: 'pretty',
        desc: 'Output format'
      }
    },
    run: (output, { globals }) => {
      if (output === undefined) return
      const raw = globals.format
      if (!isFormat(raw)) {
        console.error(`Invalid --format: ${String(raw)} (expected ${FORMATS.join('|')})`)
        return
      }
      formatAndWrite(output, raw)
    }
  })
