import { describe, expect, it } from 'bun:test'
import { pickResolvedGlobals } from './pick_resolved_globals.util.ts'

describe('pickResolvedGlobals()', () => {
  describe('when flat input has extra keys', () => {
    it('keeps only schema keys', () => {
      const schema = {
        verbose: { type: 'boolean' as const, default: false },
        region: { type: 'string' as const, default: 'eu' }
      }
      const flat = { verbose: true, region: 'us', stray: 1 }
      expect(pickResolvedGlobals(flat, schema)).toEqual({ verbose: true, region: 'us' })
    })
  })
})
