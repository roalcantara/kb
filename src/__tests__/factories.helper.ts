import type { GreeterInput } from '@core'
import { Factory } from 'fishery'
import { type FactoryBuildOpts, isFactoryOpts, type WrappedFactoryOpts } from './factories.types'
import { type InfoCommandTestCtx, makeCtx } from './factories/ctx.factory.ts'
import { params_for } from './param.parser'

// FACTORIES
// =============================================================================
const greeterFactory = Factory.define<GreeterInput>(() => ({
  name: 'World',
  times: 1
}))

const infoCommandCtxFactory = Factory.define<InfoCommandTestCtx>(() => makeCtx())
const factories = {
  greeter: greeterFactory,
  ctx: infoCommandCtxFactory
} as const

// FACTORIES' DERIVED TYPES
// =============================================================================
type Factories = typeof factories
type FactoryNames = keyof Factories
type FactoryBuildFunction<T extends FactoryNames> = Factories[T]['build']
type FactoryResults = { [K in FactoryNames]: ReturnType<FactoryBuildFunction<K>> }
type Result<T extends FactoryNames> = FactoryResults[T]
type Params = { [K in FactoryNames]: Partial<Parameters<FactoryBuildFunction<K>>[0]> }
type FactoryOptions<T extends FactoryNames> = FactoryBuildOpts<Result<T>, Params[T]>
type FactoryParams<T extends FactoryNames> = Parameters<FactoryBuildFunction<T>>[0]

/**
 * Builds a factory instance.
 * @param name - The name of the factory (keys of the factories object)
 * @param arg - Plain partial overrides or `{ overrides?, afterBuild?, associations?, transient? }`
 */
export const factory_for = <T extends FactoryNames>(name: T, opts?: FactoryOptions<T>) => {
  const factory = factories[name]
  if (opts === undefined) {
    return factory.build() as FactoryResults[T]
  }
  if (isFactoryOpts(opts)) {
    const w = opts as WrappedFactoryOpts<Result<T>, Params[T]>
    const second = params_for<Result<T>>(w)
    let built = factory.build(w.overrides as FactoryParams<T>, second) as Result<T>
    if (w.afterBuild) built = w.afterBuild(built) as Result<T>
    return built as FactoryResults[T]
  }
  return factory.build(opts as FactoryParams<T>) as FactoryResults[T]
}

// NOTE: CLI stdout capture lives in `mocks.helper.ts` as `mock_for('runAndCaptureStdout', ...)`
