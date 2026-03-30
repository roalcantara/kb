import type { KliHandle, OptsDef } from '@kb/kli/headless'

export const defineInfoCommand = <
  DepsT extends { greeter: unknown },
  GlobalsT extends OptsDef
>(
  shell: KliHandle<DepsT, GlobalsT>
) =>
  shell.withCmd({
    name: 'info',
    desc: 'Print current CLI configuration',
    args: {
      path: { type: 'file', default: '~/.config/kodexb/config.yml' }
    },
    opts: {
      source: { type: 'string', default: '~/.config/kodexb/sources' }
    },
    run: ({ deps, args, opts, globals }) => {
      if (globals.verbose) {
        console.log('Verbose mode is enabled')
      }
      if (globals.debug) {
        console.debug('DEBUG Enabled!', { args, opts, globals })
        console.debug(`ARGS: path => ${args.path}`)
        console.debug(`OPTS: source => ${opts.source}\n\n`)
      }
      return {
        cli: 'kb',
        hasGreeter: typeof deps.greeter === 'function'
      }
    }
  })
