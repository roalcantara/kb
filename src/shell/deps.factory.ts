import { greeter } from '@core'

export type AppDeps = {
  greeter: typeof greeter
}

export function buildDeps(): AppDeps {
  return {
    greeter
  }
}
