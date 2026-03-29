import type { EnvMap } from './argv.schema.ts'

const LONG_PREFIX_SIZE = 2
const HOME_KEY = 'HOME'

/**
 * Expands `~`, `~/…`, and `$VAR` placeholders in a path-like string using `env`.
 */
export const expandFileValue = (value: string, env: EnvMap): string => {
  const home = env[HOME_KEY] ?? ''
  const homeExpanded =
    value === '~' ? home : value.startsWith('~/') ? `${home}/${value.slice(LONG_PREFIX_SIZE)}` : value
  return homeExpanded.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_full, envName: string) => env[envName] ?? '')
}
