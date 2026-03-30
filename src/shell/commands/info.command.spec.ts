import { describe, expect, it } from 'bun:test'
import { testCommand } from '@kb/kli/testing'
import { factory_for, mock_for } from '@tests'
import { runCli } from '../index.ts'
import { infoCommand } from './info.command.ts'

const RAW_LINE_STARTS_WITH_CLI_TAB = /^cli\t/

describe('infoCommand', () => {
  it('returns 0 via testCommand unit path', async () => {
    const result = await testCommand(infoCommand as never, factory_for('ctx') as never)
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
          const { code, text } = await mock_for('runAndCaptureStdout', { runCli, tokens: ['info', ...c.tokens] })
          expect(code).toBe(0)
          const parsed = JSON.parse(text) as { cli: string; hasGreeter?: boolean }
          expect(parsed.cli).toBe('kb')
          if ('hasGreeter' in parsed) expect(typeof parsed.hasGreeter).toBe('boolean')
        })
      }
    })

    describe('yaml', () => {
      const cases = [
        { label: '--yaml', tokens: ['--yaml'] },
        { label: '-y', tokens: ['-y'] }
      ] as const

      for (const c of cases) {
        it(`${c.label} prints YAML-shaped lines and exits 0`, async () => {
          const { code, text } = await mock_for('runAndCaptureStdout', { runCli, tokens: ['info', ...c.tokens] })
          expect(code).toBe(0)
          expect(text).toContain('cli:')
        })
      }
    })

    describe('raw', () => {
      const cases = [
        { label: '--raw', tokens: ['--raw'] },
        { label: '-r', tokens: ['-r'] }
      ] as const

      for (const c of cases) {
        it(`${c.label} prints tab-separated fields and exits 0`, async () => {
          const { code, text } = await mock_for('runAndCaptureStdout', { runCli, tokens: ['info', ...c.tokens] })
          expect(code).toBe(0)
          expect(text).toMatch(RAW_LINE_STARTS_WITH_CLI_TAB)
        })
      }
    })
  })
})
