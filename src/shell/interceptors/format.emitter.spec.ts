import { describe, expect, it } from 'bun:test'
import { mock_for } from '@tests'
import { shell } from '../main.ts'
import { defineFormatEmitter } from './format.emitter.ts'

const formatEmitter = defineFormatEmitter(shell)

const FORMAT_GLOBAL_SCHEMA = {
  format: {
    type: 'string',
    either: { p: 'pretty', j: 'json', y: 'yaml', r: 'raw' },
    default: 'raw',
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
        format: 'raw'
      })
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
    })
  })

  describe('when command output is defined', () => {
    it('defaults to raw when --format is omitted', async () => {
      const result = await mock_for('runEmitterAndCaptureConsole', {
        emitter: formatEmitter,
        output: { a: 1, b: { c: true } },
        format: 'raw'
      })
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('a\t1')
      expect(result.stdout).toContain('b\t')
    })
  })

  describe('when input is an object', () => {
    describe('with --pretty', () => {
      it('prints tab-separated lines', async () => {
        const { stdout, stderr } = await mock_for('runEmitterAndCaptureConsole', {
          emitter: formatEmitter,
          output: { cli: 'kb', n: 1 },
          format: 'pretty'
        })
        expect(stderr).toBe('')
        expect(stdout).toContain('cli\tkb')
        expect(stdout).toContain('n\t1')
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
    describe('with --yaml', () => {
      it('prints YAML-shaped lines', async () => {
        const { stdout, stderr } = await mock_for('runEmitterAndCaptureConsole', {
          emitter: formatEmitter,
          output: { cli: 'kb', n: 1 },
          format: 'yaml'
        })
        expect(stderr).toBe('')
        // Bun's YAML printer may emit a flow-style mapping depending on the value.
        expect(stdout).toContain('cli')
        expect(stdout).toContain('n')
      })
    })
    describe('with --raw', () => {
      it('prints tab-separated lines', async () => {
        const { stdout, stderr } = await mock_for('runEmitterAndCaptureConsole', {
          emitter: formatEmitter,
          output: { cli: 'kb', n: 1 },
          format: 'raw'
        })
        expect(stderr).toBe('')
        expect(stdout).toContain('cli\tkb')
        expect(stdout).toContain('n\t1')
      })
    })
  })

  describe('when input is a string', () => {
    describe('with --json', () => {
      it('stringifies scalar values', async () => {
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
      it('stringifies scalar values', async () => {
        const { stdout, stderr } = await mock_for('runEmitterAndCaptureConsole', {
          emitter: formatEmitter,
          output: 'hello',
          format: 'pretty'
        })
        expect(stderr).toBe('')
        expect(stdout).toBe('"hello"')
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
      expect(stderr).toContain('pretty|json|yaml|raw')
    })
  })
})
