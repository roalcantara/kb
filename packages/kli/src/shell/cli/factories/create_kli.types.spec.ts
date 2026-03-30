import { describe, expect, it } from 'bun:test'
import { factory_for } from '@kli/tests'
import { expectTypeOf } from 'expect-type'
import { createKli } from './create_kli.factory.ts'

describe('createKli()', () => {
  describe('when withCmd run callback is typed', () => {
    it('narrows deps globals args and opts', () => {
      const shell = createKli({
        packageJson: factory_for('pkg', { description: 'app' }),
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
})
