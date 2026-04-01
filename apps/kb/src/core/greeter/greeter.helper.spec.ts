import { describe, expect, it } from 'bun:test'
import { factory_for } from '@tests'
import { greeter } from './greeter.helper'

describe('greet()', () => {
  describe.each([
    [factory_for('greeter'), 'Hello "World" via Bun!'],
    [
      factory_for('greeter', { name: 'TypeScript', times: 2 }),
      'Hello "TypeScript" via Bun!\n\nHello "TypeScript" via Bun!'
    ],
    [
      factory_for('greeter', { overrides: { name: 'Wrapped', times: 2 } }),
      'Hello "Wrapped" via Bun!\n\nHello "Wrapped" via Bun!'
    ]
  ])('with input %j', (input, expected) => {
    it(`greets ${input.name} ${input.times} times`, () => {
      expect(greeter(input)).toBe(expected)
    })
  })

  it('applies afterBuild when using overrides wrapper', () => {
    const afterBuildTimes = 3 as const
    const input = factory_for('greeter', {
      overrides: { name: 'Hook' },
      afterBuild: g => ({ ...g, times: afterBuildTimes })
    })
    expect(input.times).toBe(afterBuildTimes)
    expect(greeter(input)).toBe('Hello "Hook" via Bun!\n\nHello "Hook" via Bun!\n\nHello "Hook" via Bun!')
  })
})
