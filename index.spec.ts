import { describe, expect, it } from 'bun:test'
import { greet } from './index'

describe('greet()', () => {
  describe.each([
    ['World', 1, 'Hello "World" via Bun!'],
    ['TypeScript', 2, 'Hello "TypeScript" via Bun!\n\nHello "TypeScript" via Bun!']
  ])('with $name $times times', (name, times, expected) => {
    it(`greets ${name} ${times} times`, () => {
      expect(greet(name, times)).toBe(expected)
    })
  })
})
