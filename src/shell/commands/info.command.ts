import { withAppCommand } from '../cli_kit.ts'

export const infoCommand = withAppCommand({
  name: 'info',
  desc: 'Print current CLI configuration',
  args: {
    path: { type: 'file', default: '~/.config/kodexb/config.yml' }
  } as const,
  opts: {
    source: { type: 'string', default: '~/.config/kodexb/sources' }
  } as const,
  run: ({ deps, globals, args, opts }) => {
    if (globals.verbose) {
      console.log('Verbose mode is enabled')
    }
    if (globals.verbose) {
      console.debug('DEBUG Enabled!', { args, opts })
      console.debug(`ARGS: path => ${args['path']}`) // => What does this print?
      console.debug(`OPTS: config => ${opts['config']}`) // => What does this print?
    }
    const output = {
      cli: 'kb',
      hasGreeter: typeof deps.greeter === 'function'
    }
    console.log(JSON.stringify(output, null, 2))
  }
})
