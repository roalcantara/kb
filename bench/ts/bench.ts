import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type * as sqliteModule from 'node:sqlite'
import type { DatabaseSync } from 'node:sqlite'
import { resolveCorpus } from './corpus'
import { captureEnv } from './env'
import { buildEntryMarkdown } from './kb/src/markdown'
import { type IndexRow, indexRowToEntry } from './kb/src/row'
import { buildSearchSql, renderSearchSql } from './kb/src/search'
import { scanKnowledgeBase } from './kb/src/source'
import { syncKnowledgeBase } from './kb/src/sync'
import { type CaseResult, measure, measureAsync } from './measure'
import { loadQueries, toSearchQuery } from './query'

const SCHEMA_VERSION = 1

function arg(name: string): string {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) throw new Error(`missing --${name}`)
  const value = process.argv[index + 1]
  if (value === undefined) throw new Error(`missing --${name}`)
  return value
}

type SqliteModule = typeof sqliteModule
const sqlite = process.getBuiltinModule('node:sqlite') as SqliteModule

function openReadOnly(path: string): DatabaseSync {
  // What @raycast/utils' executeSQL does for every query.
  const db = new sqlite.DatabaseSync(path, { open: false, readOnly: true })
  db.open()
  return db
}

async function main(): Promise<void> {
  const fixtures = resolve(arg('fixtures'))
  const corpus = resolveCorpus(arg('corpus'), fixtures)
  const out = resolve(arg('out'))
  const queries = loadQueries(join(fixtures, 'queries.json'))
  const work = mkdtempSync(join(tmpdir(), 'kb-bench-'))
  const database = join(work, 'kb.db')
  const removeDatabase = (): void => {
    for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(`${database}${suffix}`, { force: true })
  }
  const cases: CaseResult[] = []

  try {
    const scanned = scanKnowledgeBase(corpus.root)
    cases.push(measure('scan', { warmup: 3, samples: 20 }, () => scanKnowledgeBase(corpus.root)))
    cases.push(measure('markdown', { warmup: 3, samples: 20 }, () => {
      for (const entry of scanned.entries) buildEntryMarkdown(entry)
    }))
    cases.push(
      await measureAsync(
        'sync-cold',
        { warmup: 2, samples: 10, setup: removeDatabase },
        () => syncKnowledgeBase(corpus.root, database)
      )
    )
    cases.push(
      await measureAsync('sync-warm', { warmup: 2, samples: 10 }, () => syncKnowledgeBase(corpus.root, database))
    )

    const connection = openReadOnly(database)
    const versionRow = connection.prepare('SELECT sqlite_version() AS v').get()
    const sqliteVersion = typeof versionRow === 'object' && versionRow !== null && 'v' in versionRow
      ? String(versionRow.v)
      : 'unknown'
    try {
      for (const query of queries) {
        const statement = buildSearchSql(toSearchQuery(query))
        const rendered = renderSearchSql(statement)
        cases.push(measure(`search-app/${query.id}`, { warmup: 20, samples: 200 }, () => {
          const db = openReadOnly(database)
          try {
            const rows = db.prepare(rendered).all() as unknown as IndexRow[]
            return rows.map(indexRowToEntry)
          } finally {
            db.close()
          }
        }))
        const prepared = connection.prepare(statement.sql)
        cases.push(
          measure(`search-engine/${query.id}`, { warmup: 50, samples: 500 }, () => prepared.all(...statement.params))
        )
      }
    } finally {
      connection.close()
    }

    const result = {
      schema: SCHEMA_VERSION,
      tier: 1,
      implementation: 'ts',
      corpus: { name: corpus.name, digest: corpus.digest, files: corpus.files, entries: scanned.entries.length },
      env: captureEnv(sqliteVersion, process.env.KB_TS_REPO ?? ''),
      cases
    }
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`)
    console.log(`${cases.length} cases -> ${out}`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

await main()
