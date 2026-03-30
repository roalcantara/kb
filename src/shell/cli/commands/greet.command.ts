import type { KliHandle, OptsDef } from '@kb/kli/headless'

export const defineGreetCommand = <
  DepsT extends { greeter: (a: { name: string }) => unknown },
  GlobalsT extends OptsDef
>(
  shell: KliHandle<DepsT, GlobalsT>
) =>
  shell.withCmd({
    name: 'greet',
    desc: 'Greet someone',
    args: {
      name: { type: 'string', required: false, default: 'World' }
    },
    run: ({ args, deps, globals }) => {
      if (globals.debug) {
        console.debug('DEBUG Enabled!', { args, deps, globals })
      }

      return deps.greeter({ name: args.name })
    }
  })
