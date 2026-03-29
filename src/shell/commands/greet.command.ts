import { shell } from '../main.ts'

export const greetCommand = shell.withCmd({
  name: 'greet',
  desc: 'Greet someone',
  args: {
    name: { type: 'string', required: false, default: 'World' }
  },
  run: ({ args, deps, globals }) => {
    if (globals.debug) {
      console.debug('DEBUG Enabled!', { args, deps, globals })
    }

    console.log(deps.greeter({ name: args.name }))
  }
})
