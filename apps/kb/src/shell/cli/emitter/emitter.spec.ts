import { describe, expect, it } from 'bun:test'
import { formatPayload } from './emitter'

describe('.formatPayload', () => {
  describe('when format is json', () => {
    it('serializes an object with 2-space indent', () => {
      expect(formatPayload({ a: 1 }, 'json')).toBe('{\n  "a": 1\n}')
    })

    it('serializes an array', () => {
      expect(formatPayload([1, 2], 'json')).toBe('[\n  1,\n  2\n]')
    })

    it('serializes null', () => {
      expect(formatPayload(null, 'json')).toBe('null')
    })

    it('serializes an empty array', () => {
      expect(formatPayload([], 'json')).toBe('[]')
    })
  })

  describe('when format is raw', () => {
    describe('with an array of objects', () => {
      it('writes one tab-separated line per record', () => {
        const payload = [
          { a: '1', b: '2' },
          { a: '3', b: '4' }
        ]
        expect(formatPayload(payload, 'raw')).toBe('1\t2\n3\t4')
      })
    })

    describe('with an empty array', () => {
      it('returns an empty string', () => {
        expect(formatPayload([], 'raw')).toBe('')
      })
    })

    describe('with a single object', () => {
      it('writes values tab-separated', () => {
        expect(formatPayload({ x: 'hello', y: 'world' }, 'raw')).toBe('hello\tworld')
      })
    })

    describe('with a primitive', () => {
      it('converts to string', () => {
        expect(formatPayload(42, 'raw')).toBe('42')
      })
    })
  })

  describe('when format is pretty', () => {
    describe('with an array of objects', () => {
      it('includes a header row with all keys', () => {
        const payload = [{ name: 'alice', age: '30' }]
        const lines = formatPayload(payload, 'pretty').split('\n')
        expect(lines[0]).toContain('name')
        expect(lines[0]).toContain('age')
      })

      it('includes all values in subsequent rows', () => {
        const payload = [
          { name: 'alice', age: '30' },
          { name: 'bob', age: '4' }
        ]
        const lines = formatPayload(payload, 'pretty').split('\n')
        expect(lines[1]).toContain('alice')
        expect(lines[2]).toContain('bob')
      })

      it('aligns values under their header column', () => {
        const payload = [{ k: 'short' }, { k: 'a-much-longer-value' }]
        const lines = formatPayload(payload, 'pretty').split('\n')
        expect(lines[0]?.indexOf('k')).toBe(lines[1]?.indexOf('short'))
      })
    })

    describe('with an empty array', () => {
      it('returns an empty string', () => {
        expect(formatPayload([], 'pretty')).toBe('')
      })
    })

    describe('with a single object', () => {
      it('renders each key on its own line', () => {
        const result = formatPayload({ status: 'ok', code: '200' }, 'pretty')
        const lines = result.split('\n')
        expect(lines).toHaveLength(2)
      })

      it('includes the key and value on each line', () => {
        const result = formatPayload({ status: 'ok' }, 'pretty')
        expect(result).toContain('status')
        expect(result).toContain('ok')
      })
    })

    describe('with a primitive', () => {
      it('converts to string', () => {
        expect(formatPayload('hello', 'pretty')).toBe('hello')
      })
    })
  })
})
