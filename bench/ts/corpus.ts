import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/** A corpus a run measures, identified by a digest so results can prove which one they used. */
export interface Corpus {
  readonly name: 'sample' | 'private' | 'private-10x'
  readonly root: string
  /** SHA-256 of the corpus manifest (the private manifest for both private corpora). */
  readonly digest: string
  readonly files: number
}

const NAMES = ['sample', 'private', 'private-10x'] as const
const COPIES = Array.from({ length: 10 }, (_, i) => `copy-${i}`)

function yamlFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.ya?ml$/.test(entry.name))
    .map(entry => join(entry.parentPath, entry.name))
}

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * The manifest of a directory in `shasum -a 256` format: one `<hash>  ./<path>` line per YAML
 * file, sorted bytewise by path — the same text the `fixtures` mise task writes.
 */
export function manifestOf(dir: string): string {
  const lines = yamlFiles(dir)
    .map(file => `./${relative(dir, file)}`)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map(path => `${sha256(readFileSync(join(dir, path)))}  ${path}`)
  return lines.length === 0 ? '' : `${lines.join('\n')}\n`
}

/**
 * Resolves a corpus under `fixturesDir` and, for the private ones, refuses to return a corpus
 * that no longer matches `private.sha256`: a benchmark of a drifted corpus is not comparable.
 */
export function resolveCorpus(name: string, fixturesDir: string): Corpus {
  if (!(NAMES as readonly string[]).includes(name)) {
    throw new Error(`unknown corpus "${name}"; expected one of ${NAMES.join(', ')}`)
  }
  const corpusName = name as Corpus['name']
  const root = resolve(fixturesDir, corpusName)
  if (corpusName === 'sample') {
    const files = yamlFiles(root).length
    return { name: corpusName, root, digest: sha256(manifestOf(root)), files }
  }
  // Distinct files: private-10x holds ten copies of the same set.
  const files = yamlFiles(join(fixturesDir, 'private')).length

  const expected = readFileSync(join(fixturesDir, 'private.sha256'), 'utf8')
  const copies = corpusName === 'private' ? [root] : COPIES.map(copy => join(root, copy))
  for (const dir of [join(fixturesDir, 'private'), ...copies]) {
    if (!existsSync(dir) || manifestOf(dir) !== expected) {
      throw new Error(`${relative(fixturesDir, dir)} does not match fixtures/private.sha256; run \`mise run fixtures\``)
    }
  }
  return { name: corpusName, root, digest: sha256(expected), files }
}
