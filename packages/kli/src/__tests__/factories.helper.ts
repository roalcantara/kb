import { Factory } from 'fishery'
import type { ArgsDef, CliCommand, CommandDef, OptsDef } from '@kli/core/cli'
import type { PackageJsonLike } from '@kli/shell/cli'

/** Synthetic `argv[0]` / `argv[1]` (Bun runtime + script before user tokens). */
const MOCK_BUN_ARGV0 = '/bun'
const MOCK_BUN_ARGV1 = 'index.ts'

/** Bun-style `argv` prefix + user tokens; same shape as Fishery’s `.build(...args)`. */
const bun_style_argv_factory = {
  build: (...tokens: string[]): string[] => [MOCK_BUN_ARGV0, MOCK_BUN_ARGV1, ...tokens]
} as const

/** Default command table for {@link packages/kli/src/core/cli/parsing/argv_parse.service.spec.ts}. */
const parseArgvCommandFactory = Factory.define<CommandDef>(() => ({
  name: 'build',
  args: {
    target: { type: 'string' },
    'files...': { type: 'string' }
  },
  opts: {
    config: { type: 'file', short: 'c', env: 'KLI_CONFIG', default: '~/default.yml' },
    limit: { type: 'number' },
    verbose: { type: 'boolean' },
    format: {
      type: 'string',
      either: { p: 'pretty', j: 'json' }
    }
  }
}))

/** Default command table for {@link packages/kli/src/core/cli/parsing/argv_parse.service.spec.ts}. */
const parseArgvCommandsFactory = Factory.define<CommandDef[]>(() => [parseArgvCommandFactory.build()])

const pkgFactory = Factory.define<PackageJsonLike>(() => ({
  name: 't',
  version: '1.0.0',
  description: 't'
}))

/** package.json-like defaults for {@link packages/kli/src/shell/cli/main.cli.spec.ts}. */
const cliDemoPkgFactory = Factory.define<PackageJsonLike>(() => ({
  name: 'demo',
  version: '1.0.0',
  description: 'demo cli'
}))

const DEFAULT_MAIN_CLI_REGION = 'eu-west-1' as const

/** Globals schema shared by main.cli integration tests (see `main.cli.spec.ts`). */
const MAIN_CLI_TEST_GLOBALS = {
  region: { type: 'string' as const, default: DEFAULT_MAIN_CLI_REGION }
} as const

type MainCliTestGlobals = typeof MAIN_CLI_TEST_GLOBALS

const mainCliGlobalsFactory = Factory.define<MainCliTestGlobals>(() => ({
  region: { type: 'string' as const, default: DEFAULT_MAIN_CLI_REGION }
}))

/** Default `opts` for {@link mainCliDemoInfoFactory} (main.cli integration tests). */
const MAIN_CLI_DEMO_INFO_OPTS = {
  format: { type: 'string' as const, default: 'json' }
} as const

/** Default `info` command for {@link packages/kli/src/shell/cli/main.cli.spec.ts}; pass `.build(overrides)` to swap `run` / `middleware` / `args`. */
const mainCliDemoInfoFactory = Factory.define<
  CliCommand<unknown, ArgsDef, typeof MAIN_CLI_DEMO_INFO_OPTS, MainCliTestGlobals>
>(() => ({
  name: 'info',
  desc: 'show info',
  opts: MAIN_CLI_DEMO_INFO_OPTS,
  run: ({ opts }) => {
    console.log(JSON.stringify({ ok: true, format: opts.format ?? 'json' }))
  }
}))

/** Primary command for {@link packages/kli/src/core/cli/validation/validate_command.service.spec.ts}. */
const validateCommandPrimaryCommandFactory = Factory.define<CommandDef>(() => ({
  name: 'build',
  args: {
    target: { type: 'string' }
  },
  opts: {
    config: { type: 'file', short: 'c', required: true },
    format: {
      type: 'string',
      either: { p: 'pretty', j: 'json' }
    }
  }
}))

const validateCommandMergeGlobalOptsFactory = Factory.define<OptsDef>(() => ({
  format: { type: 'number', default: 10 }
}))

const validateCommandMergeLocalCommandFactory = Factory.define<CommandDef>(() => {
  const base = validateCommandPrimaryCommandFactory.build()
  return {
    ...base,
    opts: {
      ...base.opts,
      format: { type: 'string', default: 'json' }
    }
  }
})

const validateCommandRegionGlobalOptsFactory = Factory.define<OptsDef>(() => ({
  region: { type: 'string', default: 'eu-west-1' }
}))

const VALIDATE_COMMAND_API_KEY_ENV = 'KLI_TEST_API' as const

const validateCommandApiKeyCommandFactory = Factory.define<CommandDef>(() => ({
  name: 'x',
  opts: { apiKey: { type: 'string', env: VALIDATE_COMMAND_API_KEY_ENV, required: true } }
}))

const validateCommandApiKeyEnvFactory = Factory.define<Record<string, string | undefined>>(() => ({
  [VALIDATE_COMMAND_API_KEY_ENV]: 'secret'
}))

/** Named argv tails for validate_command tests (Bun prefix added in {@link validate_command_argv_factory.build}). */
const validate_command_argv_scenarios = {
  full: ['build', 'prod', '--config', '/tmp/a.yml'],
  noTarget: ['build', '--config', '/tmp/a.yml'],
  noConfig: ['build', 'prod'],
  eitherClash: ['build', 'prod', '--config', '/tmp/a.yml', '-p', '-j'],
  emptyTail: ['build'],
  xOnly: ['x']
} as const satisfies Record<string, readonly string[]>

type ValidateCommandArgvScenario = keyof typeof validate_command_argv_scenarios

const validate_command_argv_factory = {
  build: (scenario: ValidateCommandArgvScenario): string[] =>
    bun_style_argv_factory.build(...validate_command_argv_scenarios[scenario])
} as const

const factories = {
  pkg: pkgFactory,
  cliDemoPkg: cliDemoPkgFactory,
  mainCliGlobals: mainCliGlobalsFactory,
  mainCliDemoInfo: mainCliDemoInfoFactory,
  parseArgvCommand: parseArgvCommandFactory,
  parseArgvCommands: parseArgvCommandsFactory,
  bunStyleArgv: bun_style_argv_factory,
  validateCommandPrimaryCommand: validateCommandPrimaryCommandFactory,
  validateCommandMergeGlobalOpts: validateCommandMergeGlobalOptsFactory,
  validateCommandMergeLocalCommand: validateCommandMergeLocalCommandFactory,
  validateCommandRegionGlobalOpts: validateCommandRegionGlobalOptsFactory,
  validateCommandApiKeyCommand: validateCommandApiKeyCommandFactory,
  validateCommandApiKeyEnv: validateCommandApiKeyEnvFactory,
  validateCommandArgv: validate_command_argv_factory
} as const

type Factories = typeof factories
type FactoryNames = keyof Factories

type FactoryResults = { [K in FactoryNames]: ReturnType<Factories[K]['build']> }

/** Forwards to each entry’s `.build` (Fishery params/options or e.g. `bunStyleArgv` token list). */
export const factory_for = <T extends FactoryNames>(
  name: T,
  ...args: Parameters<Factories[T]['build']>
): FactoryResults[T] =>
  (factories[name].build as (...fnArgs: unknown[]) => FactoryResults[T])(...args) as FactoryResults[T]
