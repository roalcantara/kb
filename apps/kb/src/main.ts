import { greet } from './commands/greet.command'

export const setup = () => ({
  run: (name = 'World', times = 1) => {
    console.log(greet(name, times))
  }
})
