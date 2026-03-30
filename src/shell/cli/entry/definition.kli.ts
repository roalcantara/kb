import { greeter } from '@core'

import pkg from '../../../../package.json'
import { timingMiddleware } from '../middleware/timing.middleware.ts'

/** Shared {@link createKli} / {@link createKliHeadless} input for `kb` (single source for jscpd). */
export const kliDefinition = {
  name: 'kb' as const,
  packageJson: pkg,
  deps: { greeter },
  globals: {
    verbose: { type: 'boolean' as const, default: false, desc: 'Print extra informational messages' },
    debug: { type: 'boolean' as const, default: false, desc: 'Print debug details (args, opts, globals)' }
  },
  middleware: [timingMiddleware] as const
}
