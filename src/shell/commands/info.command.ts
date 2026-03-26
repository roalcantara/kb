import { withCommand } from '@kb/kli'

import type { AppDeps } from '../deps.factory.ts'

export const infoCommand = withCommand<AppDeps>({
  name: 'info',
  desc: 'Print current CLI configuration',
  run: ({ deps }) => {
    const output = {
      cli: 'kb',
      hasGreeter: typeof deps.greeter === 'function'
    }
    console.log(JSON.stringify(output, null, 2))
  }
})
