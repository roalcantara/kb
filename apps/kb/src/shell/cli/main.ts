import { createKli } from '@kb/kli'
import pkg from '../../../package.json'
import { timingMiddleware } from './middleware/timing.middleware.ts'

export const shell = createKli({
  name: 'kb' as const,
  packageJson: pkg,
  deps: {},
  globals: {
    config: {
      type: 'file' as const,
      short: 'c',
      desc: 'Config file path',
      default: '~/.config/kodexb/config.yaml'
    },
    source: {
      type: 'file' as const,
      short: 's',
      desc: 'Sources directory',
      default: '~/.config/kodexb/sources'
    },
    db: {
      type: 'file' as const,
      short: 'b',
      desc: 'SQLite database path',
      default: '~/.config/kodexb/db.sqlite'
    },
    verbose: { type: 'boolean' as const, default: false, desc: 'Print extra informational messages' },
    debug: { type: 'boolean' as const, short: 'd', default: false, desc: 'Structured debug log on stderr' }
  },
  middleware: [timingMiddleware] as const
})
