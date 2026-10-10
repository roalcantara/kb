#!/usr/bin/env bun
// mise run graph (tools/graph/tasks.toml): install, set up, build or update the code graphs.
// Ported from the kb Raycast repo; mise passes the arguments as usage_* environment variables.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const action = (process.env.usage_action ?? '').trim()
const requestedTool = (process.env.usage_tool ?? 'all').trim()
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
const targets = requestedTool === 'all'
  ? Object.keys(TOOL_META) as Array<keyof typeof TOOL_META>
  : [requestedTool as keyof typeof TOOL_META]

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
// Resolve graphify's API keys from fnox (gopass) when available; fall back to the plain environment.
const withSecrets = (args: string[]): [string, string[]] =>
  exists('fnox') ? ['fnox', ['exec', '--', 'graphify', ...args]] : ['graphify', args]
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
    if (result.ok) say('docs and community labels refresh only with --force (LLM)')
    return
  }
  const extracted = runBackendChain('extract', ['extract', '.', ...(mode === 'build' ? ['--force'] : [])])
  // Plain `label` (not --missing-only): after a re-cluster, stale names are hub labels, which --missing-only keeps.
  if (extracted) runBackendChain('label', ['label', '.'])
}
const gortexDaemonUp = () => {
  const status = runCommand('gortex', ['daemon', 'status'], { quiet: true, readOnly: true })
  const command = status.ok ? ['gortex', 'daemon', 'reload'] : ['gortex', 'daemon', 'start', '--detach']
  const result = runCommand(command[0], command.slice(1), { quiet: true })
  return result.ok || result.timedOut
}
const formatUpdateStatus = (tool: string, result: { ok: boolean; timedOut: boolean }, skippedHint: string) => {
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
const repairTargets = (selected: string[]) => {
  head('repairing graph state')
  if (selected.includes('gortex')) gortexDaemonUp()
  for (const tool of selected) {
    if (tool !== 'gortex') {
      runGraphAction(tool as keyof typeof TOOL_META, 'setup')
    }
  }
  head('re-checking graph health')
}
const runGraphAction = (target: keyof typeof TOOL_META | 'all', mode: 'install' | 'setup' | 'build' | 'update') => {
  const selected = target === 'all'
    ? Object.keys(TOOL_META) as Array<keyof typeof TOOL_META>
    : [target as keyof typeof TOOL_META]
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
        runCommand('gortex', ['install'], { timeoutMs, quiet: false })
      },
      graphify: () => {
        if (dryRun) {
          console.log('  would run: graphify install --platform claude')
          return
        }
        runCommand('graphify', ['install', '--platform', 'claude'], { timeoutMs, quiet: false })
      }
    },
    setup: {
      crg: () => runCommand('code-review-graph', ['build'], { timeoutMs, quiet: false }),
      gortex: () => {
        runCommand('gortex', ['track', repo], { timeoutMs, quiet: false })
        gortexDaemonUp()
      },
      graphify: () => graphifyRefresh('setup')
    },
    build: {
      crg: () => runCommand('code-review-graph', ['build'], { timeoutMs, quiet: false }),
      gortex: () => gortexDaemonUp(),
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
        const status = runCommand('gortex', ['daemon', 'status'], { quiet: true, readOnly: true })
        if (status.ok) {
          runCommand('gortex', ['daemon', 'reload'], { quiet: true })
          say('gortex reloaded')
        } else {
          say('gortex daemon not running — skipped (mise run graph setup gortex starts it)')
        }
      },
      graphify: () => {
        if (!exists(TOOL_META.graphify.bin)) {
          say('graphify not found (ignored)')
          return
        }
        graphifyRefresh('update')
      }
    }
  } satisfies Record<string, Partial<Record<keyof typeof TOOL_META, () => void>>>

  for (const tool of selected) {
    head(`${tool}: ${ACTION_LABELS[mode]}`)
    actions[mode]?.[tool]?.()
  }
}

try {
  if (fix) {
    repairTargets(targets)
  }

  runGraphAction(requestedTool, action)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(2)
}
