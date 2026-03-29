import { greeter } from '@core'
import { createKli } from '@kb/kli'

import pkg from '../../package.json'
import { timingMiddleware } from './middleware/timing.middleware.ts'

export const shell = createKli({
  name: 'kb',
  packageJson: pkg,
  deps: { greeter },
  globals: {
    verbose: { type: 'boolean', default: false, desc: 'Print extra informational messages' },
    debug: { type: 'boolean', default: false, desc: 'Print debug details (args, opts, globals)' }
  },
  middleware: [timingMiddleware] as const
})
