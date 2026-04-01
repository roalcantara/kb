import { describe, expect, it } from 'bun:test'
import { mock_for } from '@tests'
import { shell } from '../main.ts'
import { defineFormatEmitter } from './format.emitter.ts'

const formatEmitter = defineFormatEmitter(shell)

const FORMAT_GLOBAL_SCHEMA = {
  format: {
    type: 'string',
    either: { p: 'pretty', j: 'json', r: 'raw' },
    default: 'pretty',
    desc: 'Output format'
  }
} as const

describe('formatEmitter()', () => {
  it('is defined with the expected globals schema', () => {
    expect(formatEmitter.globals).toEqual(FORMAT_GLOBAL_SCHEMA)
  })

  describe('when command output is undefined', () => {
    it('prints nothing', async () => {
      const result = await mock_for('runEmitterAndCaptureConsole', {
        emitter: formatEmitter,
        output: undefined,
        format: 'pretty'
      })
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
    })
  })

  describe('when command output is defined', () => {
    it('formats as raw when globals.format is raw', async () => {
      const result = await mock_for('runEmitterAndCaptureConsole', {
        emitter: formatEmitter,
        output: { cli: 'kb', n: 1 },
        format: 'raw'
      })
      expect(result.stderr).toBe('')
      expect(result.stdout).toBe('kb\t1')
    })
  })

  describe('when input is an object', () => {
    describe('with --pretty', () => {
      it('prints aligned key columns', async () => {
        const { stdout, stderr } = await mock_for('runEmitterAndCaptureConsole', {
          emitter: formatEmitter,
          output: { cli: 'kb', n: 1 },
          format: 'pretty'
        })
        expect(stderr).toBe('')
        expect(stdout).toContain('cli')
        expect(stdout).toContain('kb')
        expect(stdout).toContain('n')
        expect(stdout).toContain('1')
      })
    })
    describe('with --json', () => {
      it('prints indented JSON', async () => {
        const { stdout, stderr } = await mock_for('runEmitterAndCaptureConsole', {
          emitter: formatEmitter,
          output: { cli: 'kb', n: 1 },
          format: 'json'
        })
        expect(stderr).toBe('')
        expect(stdout).toBe('{\n  "cli": "kb",\n  "n": 1\n}')
        expect(JSON.parse(stdout)).toEqual({ cli: 'kb', n: 1 })
      })
    })
    describe('with --raw', () => {
      it('prints tab-separated values', async () => {
        const { stdout, stderr } = await mock_for('runEmitterAndCaptureConsole', {
          emitter: formatEmitter,
          output: { cli: 'kb', n: 1 },
          format: 'raw'
        })
        expect(stderr).toBe('')
        expect(stdout).toBe('kb\t1')
      })
    })
  })

  describe('when input is a string', () => {
    describe('with --json', () => {
      it('JSON-stringifies the scalar', async () => {
        const { stdout, stderr } = await mock_for('runEmitterAndCaptureConsole', {
          emitter: formatEmitter,
          output: 'hello',
          format: 'json'
        })
        expect(stderr).toBe('')
        expect(stdout).toBe('"hello"')
      })
    })
    describe('with --pretty', () => {
      it('prints the string as plain text', async () => {
        const { stdout, stderr } = await mock_for('runEmitterAndCaptureConsole', {
          emitter: formatEmitter,
          output: 'hello',
          format: 'pretty'
        })
        expect(stderr).toBe('')
        expect(stdout).toBe('hello')
      })
    })
    describe('with --raw', () => {
      it('prints the string as is', async () => {
        const { stdout, stderr } = await mock_for('runEmitterAndCaptureConsole', {
          emitter: formatEmitter,
          output: 'hello',
          format: 'raw'
        })
        expect(stderr).toBe('')
        expect(stdout).toBe('hello')
      })
    })
  })

  describe('when input is invalid', () => {
    it('prints a clear error and skips stdout', async () => {
      const { stdout, stderr } = await mock_for('runEmitterAndCaptureConsole', {
        emitter: formatEmitter,
        output: { ok: true },
        format: 'wat'
      })
      expect(stdout).toBe('')
      expect(stderr).toContain('Invalid --format:')
      expect(stderr).toContain('pretty|json|raw')
    })
  })
})
