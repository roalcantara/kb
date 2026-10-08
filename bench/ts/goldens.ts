import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type * as sqliteModule from 'node:sqlite'
import { resolveCorpus } from './corpus'
import { buildFtsPrefixQuery } from './kb/src/query'
import type { IndexRow } from './kb/src/row'
import { buildSearchSql } from './kb/src/search'
import { syncKnowledgeBase } from './kb/src/sync'
import { arg, loadQueries, toSearchQuery } from './query'

/** Replaces every occurrence of the corpus root, so a golden reads the same on every machine. */
function portable<T>(value: T, root: string): T {
  const escaped = JSON.stringify(root).slice(1, -1)
  return JSON.parse(JSON.stringify(value).replaceAll(escaped, '<root>')) as T
}

type SqliteModule = typeof sqliteModule
const sqlite = process.getBuiltinModule('node:sqlite') as SqliteModule

async function main(): Promise<void> {
  const fixtures = resolve(arg('fixtures'))
  const corpus = resolveCorpus(arg('corpus'), fixtures)
  const out = resolve(arg('out'))
  const work = mkdtempSync(join(tmpdir(), 'kb-goldens-'))
  const database = join(work, 'kb.db')

  try {
    const { durationMs: _, ...summary } = await syncKnowledgeBase(corpus.root, database)
    const db = new sqlite.DatabaseSync(database, { readOnly: true })
    try {
      const rows = db.prepare('SELECT * FROM entries ORDER BY id').all() as unknown as IndexRow[]

      const queries = loadQueries(join(fixtures, 'queries.json')).map(query => {
        const statement = buildSearchSql(toSearchQuery(query))
        const results = db.prepare(statement.sql).all(...statement.params) as unknown as IndexRow[]
        const fts = buildFtsPrefixQuery(query.text)
        // The sort key the statement ordered by: FTS rank, or the title when there is no text.
        const ranks = new Map<string, number>()
        if (fts !== '') {
          const ranked = db
            .prepare(
              'SELECT e.id AS id, fts.rank AS rank FROM entries_fts(?) fts JOIN entries e ON e.rowid = fts.rowid'
            )
            .all(fts) as { id: string; rank: number }[]
          for (const { id, rank } of ranked) ranks.set(id, rank)
        }
        return {
          ...query,
          results: results.map(row => ({ id: row.id, sortKey: fts === '' ? row.title : ranks.get(row.id) }))
        }
      })

      mkdirSync(out, { recursive: true })
      writeFileSync(
        join(out, 'rows.jsonl'),
        rows.map(row => JSON.stringify(portable(row, corpus.root))).join('\n') + '\n'
      )
      writeFileSync(join(out, 'summary.json'), `${JSON.stringify(portable(summary, corpus.root), null, 2)}\n`)
      writeFileSync(join(out, 'queries.json'), `${JSON.stringify(queries, null, 2)}\n`)
      console.log(`${rows.length} rows, ${queries.length} queries -> ${out}`)
    } finally {
      db.close()
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

await main()
