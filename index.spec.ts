import { describe, expect, it } from 'bun:test'
import { greet } from './index'

describe('greet()', () => {
  describe.each([
    [{ name: 'World', times: 1 }, 'Hello "World" via Bun!'],
    [{ name: 'TypeScript', times: 2 }, 'Hello "TypeScript" via Bun!\n\nHello "TypeScript" via Bun!']
  ])('with input %j', (input, expected) => {
    it(`greets ${input.name} ${input.times} times`, () => {
      expect(greet(input)).toBe(expected)
    })
  })
})
