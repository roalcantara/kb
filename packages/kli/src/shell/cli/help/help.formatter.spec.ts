import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import { factory_for } from '@kli/tests'
import { withCli } from '../factories/index.ts'
import { printHelp } from './index.ts'

describe('printHelp()', () => {
  describe('when cli defines globals with either opts', () => {
    let text: string
    const pkgOverrides = { name: '1', version: '1.0.0', description: 'd' } as const
    const pkg = factory_for('pkg', pkgOverrides)
    const log = spyOn(console, 'log').mockImplementation(() => undefined)
    const subject = {
      name: 'demo',
      packageJson: pkg,
      deps: {},
      globals: {
        verbose: { type: 'boolean', default: false, desc: 'Verbose logging' },
        format: {
          type: 'string',
          either: { p: 'pretty', j: 'json', y: 'yaml', r: 'raw' },
          default: 'raw',
          desc: 'Output format'
        }
      },
      commands: []
    } as const

    beforeAll(() => {
      const cli = withCli(subject)
      printHelp(cli, [])
      text = String(log.mock.calls[0]?.[0])
    })
    afterAll(() => {
      log.mockRestore()
    })

    it.each([
      ['app name', subject.name],
      ['version from package', pkgOverrides.version],
      ['description from package', pkgOverrides.description],
      ['verbose flag line', '      --verbose  Verbose logging (default=false)'],
      ['pretty alias line', '  -p, --pretty   Output format (`pretty`)'],
      ['json alias line', '  -j, --json     Output format (`json`)'],
      ['yaml alias line', '  -y, --yaml     Output format (`yaml`)'],
      ['raw default line', '  -r, --raw      Output format (`raw`) (default)']
    ] as const)('output contains %s', (_, expected) => {
      expect(text).toContain(expected)
    })
  })
})
