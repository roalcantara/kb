import { expect, spyOn, test } from 'bun:test'

import { withCli } from '../factories/cli_instance.factory.ts'
import { printHelp } from './help.formatter.ts'

test('printHelp expands either group and prints desc', () => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined)
  const cli = withCli({
    name: 't',
    packageJson: { name: 't', version: '1.0.0', description: 'd' },
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
  })
  printHelp(cli, [])
  const text = String(log.mock.calls[0]?.[0])
  expect(text).toContain('-p, --pretty')
  expect(text).toContain('Output format (`pretty`)')
  expect(text).toContain('-r, --raw')
  expect(text).toContain('Output format (`raw`) (default)')
  expect(text).toContain('--verbose')
  expect(text).toContain('Verbose logging (default=false)')
  log.mockRestore()
})
