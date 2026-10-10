#!/usr/bin/env bun
// mise run graph (tools/graph/tasks.toml): install, set up, build or update the code graphs.
// Ported from the kb Raycast repo; mise passes the arguments as usage_* environment variables.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ACTIONS = ['install', 'setup', 'build', 'update'] as const
const TOOLS = ['all', 'crg', 'gortex', 'graphify'] as const
type Action = (typeof ACTIONS)[number]
type Tool = (typeof TOOLS)[number]
const isAction = (value: string): value is Action => (ACTIONS as readonly string[]).includes(value)
const isTool = (value: string): value is Tool => (TOOLS as readonly string[]).includes(value)
const rawAction = (process.env.usage_action ?? '').trim()
const rawTool = (process.env.usage_tool ?? 'all').trim()
if (!isAction(rawAction) || !isTool(rawTool)) {
  console.error(`usage: mise run graph <${ACTIONS.join('|')}> [${TOOLS.join('|')}]`)
  process.exit(2)
}
const action: Action = rawAction
const requestedTool: Tool = rawTool
const dryRun = (process.env.usage_dry_run ?? 'false') === 'true'
const fix = (process.env.usage_fix ?? 'false') === 'true'
const force = (process.env.usage_force ?? 'false') === 'true'
const backends = (process.env.usage_backend ?? 'deepseek,gemini').split(',').map(b => b.trim()).filter(Boolean)
const toMs = (value: string | undefined, fallback: number) => {
  const seconds = Number(value)
  return Math.max(1, Number.isFinite(seconds) ? seconds * 1000 : fallback)
}
const timeoutMs = toMs(process.env.usage_timeout, 60000)
const llmTimeoutMs = toMs(process.env.usage_llm_timeout, 1800000)
const repo = process.env.REPO ?? process.cwd()
const TOOL_META = {
  crg: { bin: 'code-review-graph' },
  gortex: { bin: 'gortex' },
  graphify: { bin: 'graphify' }
} as const
const ACTION_LABELS = {
  install: 'registering MCP/server wiring',
  setup: 'setting up',
  build: 'full rebuild',
  update: 'incremental update'
} as const
type Target = keyof typeof TOOL_META
const targets: Target[] = requestedTool === 'all' ? ['crg', 'gortex', 'graphify'] : [requestedTool]

const say = (message: string) => console.log(`  ${message}`)
const head = (message: string) => console.log(`\n${message}`)
const runCommand = (
  command: string,
  args: string[] = [],
  options: { timeoutMs?: number; quiet?: boolean; readOnly?: boolean; cwd?: string } = {}
) => {
  if (dryRun && !options.readOnly) {
    say(`would run: ${command} ${args.join(' ')}`)
    return { ok: true, stdout: '', stderr: '', code: 0, timedOut: false }
  }
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repo,
    env: process.env,
    timeout: options.timeoutMs ?? timeoutMs,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const stdout = result.stdout?.toString() ?? ''
  const stderr = result.stderr?.toString() ?? ''
  const code = typeof result.status === 'number' ? result.status : 1
  const ok = result.error == null && code === 0
  const timedOut = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT'

  if (!options.quiet && stdout) process.stdout.write(stdout)
  if (!options.quiet && stderr) process.stderr.write(stderr)

  return { ok, stdout, stderr, code, timedOut }
}
const exists = (bin: string) => Bun.which(bin) != null
// Long LLM runs stream straight to the terminal instead of being buffered.
const streamCommand = (command: string, args: string[], streamTimeoutMs: number) => {
  const result = spawnSync(command, args, { cwd: repo, env: process.env, timeout: streamTimeoutMs, stdio: 'inherit' })
  return { ok: result.error == null && result.status === 0, code: result.status ?? 1 }
}
// Resolve graphify's API keys through fnox (.fnox.toml, password-store) when it can resolve them; otherwise the keys
// come from the plain environment.
let fnoxUsable: boolean | undefined
const withSecrets = (args: string[]): [string, string[]] => {
  fnoxUsable ??= exists('fnox') && runCommand('fnox', ['exec', '--', 'true'], { quiet: true, readOnly: true }).ok
  return fnoxUsable ? ['fnox', ['exec', '--', 'graphify', ...args]] : ['graphify', args]
}
const runBackendChain = (step: string, args: string[]) => {
  for (const backend of backends) {
    const [command, argv] = withSecrets([...args, '--backend', backend])
    if (dryRun) {
      say(`would run: ${command} ${argv.join(' ')}  (next backend on failure)`)
      return true
    }
    say(`graphify ${step} via ${backend}`)
    const result = streamCommand(command, argv, llmTimeoutMs)
    if (result.ok) return true
    say(`graphify ${step} via ${backend} failed (exit ${result.code})`)
  }
  say(`graphify ${step} failed on every backend: ${backends.join(', ')}`)
  process.exitCode = 1
  return false
}
const graphifyRefresh = (mode: 'setup' | 'build' | 'update') => {
  const hasGraph = existsSync(join(repo, 'graphify-out', 'graph.json'))
  if (!force || (mode === 'setup' && hasGraph)) {
    if (dryRun) {
      say('would run: graphify update .')
      return
    }
    mkdirSync(join(repo, 'graphify-out'), { recursive: true })
    const result = runCommand('graphify', ['update', '.'], { timeoutMs, quiet: false })
    formatUpdateStatus('graphify', result, 'no code changes')
    if (mode !== 'update') required('graphify update', result)
    if (result.ok) say('docs and community labels refresh only with --force (LLM)')
    return
  }
  const extracted = runBackendChain('extract', ['extract', '.', ...(mode === 'build' ? ['--force'] : [])])
  // Plain `label` (not --missing-only): after a re-cluster, stale names are hub labels, which --missing-only keeps.
  if (extracted) runBackendChain('label', ['label', '.'])
}
// Setup and build fail the task when their command fails, so `setup crg && setup graphify` stops at the first failure.
const required = (label: string, result: { ok: boolean; timedOut: boolean; code: number }) => {
  if (result.ok) return
  say(`${label} ${result.timedOut ? 'timed out (raise --timeout)' : `failed (exit ${result.code})`}`)
  process.exitCode = 1
}
// The daemon is machine-wide: only `setup gortex` starts it (spec D6); update and build reload it when it runs.
// `strict`: a failed reload fails the task (build); the background update reports it and goes on.
const gortexReload = (strict: boolean) => {
  const status = runCommand('gortex', ['daemon', 'status'], { quiet: true, readOnly: true })
  if (!status.ok) {
    say('gortex daemon not running — skipped (mise run graph setup gortex starts it)')
    return
  }
  const reload = runCommand('gortex', ['daemon', 'reload'], { quiet: true })
  if (reload.ok) say('gortex reloaded')
  else if (strict) required('gortex daemon reload', reload)
  else say(`gortex reload ${reload.timedOut ? 'timed out' : 'failed'} (ignored)`)
}
const gortexDaemonUp = () => {
  const status = runCommand('gortex', ['daemon', 'status'], { quiet: true, readOnly: true })
  const command = status.ok ? ['gortex', 'daemon', 'reload'] : ['gortex', 'daemon', 'start', '--detach']
  runCommand(command[0], command.slice(1), { quiet: true })
  // A start that timed out may not have started anything: the daemon's own status decides.
  return dryRun || runCommand('gortex', ['daemon', 'status'], { quiet: true, readOnly: true }).ok
}
const formatUpdateStatus = (
  tool: string,
  result: { ok: boolean; timedOut: boolean; stdout: string; stderr: string },
  skippedHint: string
) => {
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase()
  if (result.ok) {
    if (
      /\b0 files updated|nothing to do|already up to date|no changes required|left untouched|\b0 nodes|\b0 edges/.test(
        output
      )
    ) {
      say(`${tool} update skipped — ${skippedHint}`)
      return
    }
    say(`${tool} update completed`)
    return
  }
  if (result.timedOut) {
    say(`${tool} update timed out (ignored)`)
    return
  }
  say(`${tool} update failed (ignored)`)
}
// --fix repairs by running setup first (which may track the repo and start Gortex's daemon); `mise doctor project`
// then shows what is still wrong.
const repairTargets = (selected: Target[]) => {
  head('repairing graph state: setup')
  runGraphAction(selected, 'setup')
}
const runGraphAction = (selected: Target[], mode: Action) => {
  const actions = {
    install: {
      crg: () => {
        say('CRG: .mcp.json, .agents/skills and .claude/settings.json are committed; nothing to install')
      },
      gortex: () => {
        if (dryRun) {
          console.log('  would run: gortex install')
          return
        }
        required('gortex install', runCommand('gortex', ['install'], { timeoutMs }))
      },
      graphify: () => {
        if (dryRun) {
          console.log('  would run: graphify install --platform claude')
          return
        }
        required('graphify install', runCommand('graphify', ['install', '--platform', 'claude'], { timeoutMs }))
      }
    },
    setup: {
      crg: () => required('code-review-graph build', runCommand('code-review-graph', ['build'], { timeoutMs })),
      gortex: () => {
        required('gortex track', runCommand('gortex', ['track', repo], { timeoutMs }))
        if (!gortexDaemonUp()) {
          say('gortex daemon did not start')
          process.exitCode = 1
        }
      },
      graphify: () => graphifyRefresh('setup')
    },
    build: {
      crg: () => required('code-review-graph build', runCommand('code-review-graph', ['build'], { timeoutMs })),
      gortex: () => gortexReload(true),
      graphify: () => graphifyRefresh('build')
    },
    update: {
      crg: () => {
        const meta = TOOL_META.crg
        if (!exists(meta.bin)) {
          say('code-review-graph not found (ignored)')
          return
        }
        const result = runCommand('code-review-graph', ['update'], { timeoutMs, quiet: false })
        if (!dryRun) formatUpdateStatus('crg', result, 'nothing to update')
      },
      gortex: () => {
        const meta = TOOL_META.gortex
        if (!exists(meta.bin)) {
          say('gortex not found (ignored)')
          return
        }
        gortexReload(false)
      },
      graphify: () => {
        if (!exists(TOOL_META.graphify.bin)) {
          say('graphify not found (ignored)')
          return
        }
        graphifyRefresh('update')
      }
    }
  } satisfies Record<Action, Record<Target, () => void>>

  for (const tool of selected) {
    head(`${tool}: ${ACTION_LABELS[mode]}`)
    actions[mode][tool]()
  }
}

try {
  if (fix) repairTargets(targets)
  if (!(fix && action === 'setup')) runGraphAction(targets, action)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(2)
}
