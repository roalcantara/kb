import { describe, expect, test } from 'bun:test'
import { expectTypeOf } from 'expect-type'

import { createKli } from './create_kli.factory.ts'

describe('createKli handler inference', () => {
  test('deps, globals, args, and local opts resolve in run', () => {
    const shell = createKli({
      packageJson: { name: 't', version: '1.0.0', description: 'app' },
      deps: { token: 'tok' as const, name: 'svc' as const },
      globals: {
        verbose: { type: 'boolean', default: false },
        debug: { type: 'boolean', default: false }
      }
    })

    shell.withCmd({
      name: 'cmd',
      desc: 'cmd',
      args: { path: { type: 'file', default: '/tmp/x' } },
      opts: { format: { type: 'string', default: 'json' } },
      run: ({ deps, globals, args, opts }) => {
        expectTypeOf(deps.token).toEqualTypeOf<'tok'>()
        expectTypeOf(deps.name).toEqualTypeOf<'svc'>()
        expectTypeOf(globals.verbose).toEqualTypeOf<boolean>()
        expectTypeOf(globals.debug).toEqualTypeOf<boolean>()
        expectTypeOf(args.path).toEqualTypeOf<string>()
        expectTypeOf(opts.format).toEqualTypeOf<string>()
      }
    })

    expect(true).toBe(true)
  })
})
