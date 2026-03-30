/**
 * Compile-only regression: `setup({ emitter })` must receive one {@link CliEmitterPackage}, not an array.
 * If this file fails to compile, `setup`'s `emitter` typing regressed (object-only `setup`, not variadic).
 */
import { withCommand } from '@kli/core/cli'
import { factory_for } from '@kli/tests'
import { createKli } from './create_kli.factory.ts'

const pkg = factory_for('pkg')
const shell = createKli({ packageJson: pkg, deps: {}, globals: {} })
const emitter = shell.defineEmitter({ run: () => undefined })
const cmd = withCommand({ name: 'p', desc: 'p', run: () => undefined })

shell.setup({ commands: [cmd], emitter })

// @ts-expect-error emitter must be a single package, not a list
shell.setup({ commands: [cmd], emitter: [emitter] })
