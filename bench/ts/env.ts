import { execFileSync } from 'node:child_process'

/** Where and with what a result was produced, so two results can be judged comparable. */
export interface RunEnv {
  readonly date: string
  readonly cpu: string
  readonly model: string
  readonly os: string
  readonly power: string
  readonly runtime: string
  readonly sqlite: string
  readonly tsRepoCommit: string
  readonly repoCommit: string
}

function read(command: string, args: readonly string[]): string {
  try {
    return execFileSync(command, args, { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

export function captureEnv(sqliteVersion: string, tsRepo: string): RunEnv {
  const isBun = 'Bun' in globalThis && Boolean(globalThis.Bun)
  return {
    date: new Date().toISOString(),
    cpu: read('sysctl', ['-n', 'machdep.cpu.brand_string']),
    model: read('sysctl', ['-n', 'hw.model']),
    os: `macOS ${read('sw_vers', ['-productVersion'])}`,
    // "Now drawing from 'AC Power'" -> AC Power. Battery runs are slower and flagged in the report.
    power: read('pmset', ['-g', 'batt']).match(/'([^']+)'/)?.[1] ?? 'unknown',
    runtime: isBun ? `bun-${process.versions.bun}` : `node-${process.versions.node}`,
    sqlite: sqliteVersion,
    tsRepoCommit: read('git', ['-C', tsRepo, 'describe', '--always', '--dirty', '--abbrev=40']),
    repoCommit: read('git', ['describe', '--always', '--dirty', '--abbrev=40'])
  }
}
