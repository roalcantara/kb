import { readFileSync } from 'node:fs'
import type { SearchQuery } from './kb/src/search'

/** One entry of tools/bench/fixtures/queries.json. */
export interface BenchQuery {
  readonly id: string
  readonly text: string
  readonly types?: readonly string[]
  readonly tags?: readonly string[]
  readonly offset?: number
}

/** The app's PAGE_SIZE: every query asks for one page. */
export const PAGE_SIZE = 50

export function loadQueries(path: string): readonly BenchQuery[] {
  return JSON.parse(readFileSync(path, 'utf8')) as BenchQuery[]
}

export function toSearchQuery(query: BenchQuery): SearchQuery {
  const hasFilter = (query.types?.length ?? 0) > 0 || (query.tags?.length ?? 0) > 0
  return {
    text: query.text,
    limit: PAGE_SIZE,
    offset: query.offset ?? 0,
    ...(hasFilter ? { filter: { types: query.types ?? [], tags: query.tags ?? [] } } : {})
  }
}

export function arg(name: string): string {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) throw new Error(`missing --${name}`)
  const value = process.argv[index + 1]
  if (value === undefined) throw new Error(`missing --${name}`)
  return value
}
