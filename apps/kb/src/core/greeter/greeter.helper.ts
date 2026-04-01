import { assertGreeterInput } from '@tools'
import type { GreeterInput } from './greeter.input'

export const greeter = (input: GreeterInput) => {
  assertGreeterInput(input)
  const { name, times = 1 } = input
  return Array.from({ length: times }, () => `Hello "${name}" via Bun!`).join('\n\n')
}
