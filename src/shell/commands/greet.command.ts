import { withAppCommand } from '../cli_kit.ts'

const DEFAULT_GREET_NAME = 'World'

const GREET_ARGS = {
  name: { type: 'string', required: false }
} as const

export const greetCommand = withAppCommand({
  name: 'greet',
  desc: 'Greet someone',
  args: GREET_ARGS,
  run: ({ args, deps }) => {
    const typedArgs = args as { name?: string }
    console.log(deps.greeter({ name: typedArgs.name ?? DEFAULT_GREET_NAME }))
  }
})
