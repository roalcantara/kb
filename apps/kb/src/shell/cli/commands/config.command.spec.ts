import { describe, expect, it } from 'bun:test'
import { testCommand } from '@kb/kli/testing'
import { factory_for, mock_for } from '@tests'
import { shell } from '../main.ts'
import { runCli } from '../../../index.ts'
import { defineConfigCommand } from './config.command.ts'

const configCommand = defineConfigCommand(shell)

describe('configCommand', () => {
  it('returns 0 via testCommand unit path', async () => {
    const result = await testCommand(configCommand as never, factory_for('ctx') as never)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('')
  })

  describe('output formats', () => {
    describe('json', () => {
      const cases = [
        { label: '--json', tokens: ['--json'] },
        { label: '-j', tokens: ['-j'] }
      ] as const

      for (const c of cases) {
        it(`${c.label} prints valid JSON and exits 0`, async () => {
          const { code, text } = await mock_for('runAndCaptureStdout', { runCli, tokens: ['config', ...c.tokens] })
          expect(code).toBe(0)
          const parsed = JSON.parse(text) as { command: string }
          expect(parsed.command).toBe('config')
        })
      }
    })

    describe('pretty', () => {
      const cases = [
        { label: '--pretty', tokens: ['--pretty'] },
        { label: '-p', tokens: ['-p'] }
      ] as const

      for (const c of cases) {
        it(`${c.label} prints aligned keys and exits 0`, async () => {
          const { code, text } = await mock_for('runAndCaptureStdout', { runCli, tokens: ['config', ...c.tokens] })
          expect(code).toBe(0)
          expect(text).toContain('command')
          expect(text).toContain('config')
        })
      }
    })

    describe('raw', () => {
      const cases = [
        { label: '--raw', tokens: ['--raw'] },
        { label: '-r', tokens: ['-r'] }
      ] as const

      for (const c of cases) {
        it(`${c.label} prints tab-separated values and exits 0`, async () => {
          const { code, text } = await mock_for('runAndCaptureStdout', { runCli, tokens: ['config', ...c.tokens] })
          expect(code).toBe(0)
          expect(text).toContain('\t')
          expect(text).toContain('config')
        })
      }
    })
  })
})
