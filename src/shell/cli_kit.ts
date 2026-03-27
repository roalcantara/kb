import type { OptsDef } from '@kb/kli'
import { initKli } from '@kb/kli'

import pkg from '../../package.json'
import { buildDeps } from './deps.factory.ts'
import { timingMiddleware } from './middleware/timing.middleware.ts'

const APP_CLI_CONFIG = {
  name: 'kb',
  packageJson: pkg,
  deps: buildDeps(),
  globals: {
    verbose: { type: 'boolean', default: false },
    debug: { type: 'boolean', default: false }
  } as const satisfies OptsDef,
  middleware: [timingMiddleware] as const
} as const

const { withCmd, build, kli } = initKli(APP_CLI_CONFIG)

type WithAppCommand = typeof withCmd
type BuildAppCli = typeof build
type AppCli = typeof kli

export type AppCliGlobals = AppCli['globals']
export const withAppCommand: WithAppCommand = withCmd
export const buildAppCli: BuildAppCli = build
export { kli }
