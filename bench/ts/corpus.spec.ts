import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { manifestOf, resolveCorpus } from './corpus'

const roots: string[] = []
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'corpus-'))
  roots.push(root)
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return root
}
function tenCopies(): Record<string, string> {
  const files: Record<string, string> = { 'private/a.yml': 'a: 1\n' }
  for (let i = 0; i < 10; i++) files[`private-10x/copy-${i}/a.yml`] = 'a: 1\n'
  return files
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('manifestOf', () => {
  test('lists YAML files only, sorted, in shasum format', () => {
    const root = tree({ 'b.yml': 'b: 1\n', 'a/c.yaml': 'c: 1\n', 'notes.txt': 'ignored' })
    const lines = manifestOf(root).trimEnd().split('\n')
    expect(lines.map(line => line.split('  ')[1])).toEqual(['./a/c.yaml', './b.yml'])
    expect(lines[0]).toMatch(/^[0-9a-f]{64} {2}\.\/a\/c\.yaml$/)
  })
})

describe('resolveCorpus', () => {
  test('accepts a corpus that matches its manifest', () => {
    const fixtures = tree({ 'private/a.yml': 'a: 1\n' })
    writeFileSync(join(fixtures, 'private.sha256'), manifestOf(join(fixtures, 'private')))
    const corpus = resolveCorpus('private', fixtures)
    expect(corpus.files).toBe(1)
    expect(corpus.digest).toMatch(/^[0-9a-f]{64}$/)
  })

  test('rejects a corpus that drifted from its manifest', () => {
    const fixtures = tree({ 'private/a.yml': 'a: 1\n' })
    writeFileSync(join(fixtures, 'private.sha256'), manifestOf(join(fixtures, 'private')))
    writeFileSync(join(fixtures, 'private/a.yml'), 'a: 2\n')
    expect(() => resolveCorpus('private', fixtures)).toThrow(/does not match/)
  })

  test('verifies the 10x corpus through the manifest of its source', () => {
    const fixtures = tree(tenCopies())
    writeFileSync(join(fixtures, 'private.sha256'), manifestOf(join(fixtures, 'private')))
    expect(resolveCorpus('private-10x', fixtures).files).toBe(1)
  })

  test('rejects a 10x corpus with one drifted copy', () => {
    const fixtures = tree({ ...tenCopies(), 'private-10x/copy-7/a.yml': 'a: 2\n' })
    writeFileSync(join(fixtures, 'private.sha256'), manifestOf(join(fixtures, 'private')))
    expect(() => resolveCorpus('private-10x', fixtures)).toThrow(/copy-7 does not match/)
  })

  test('rejects a 10x corpus with a missing copy', () => {
    const { 'private-10x/copy-9/a.yml': _, ...partial } = tenCopies()
    const fixtures = tree(partial)
    writeFileSync(join(fixtures, 'private.sha256'), manifestOf(join(fixtures, 'private')))
    expect(() => resolveCorpus('private-10x', fixtures)).toThrow(/copy-9 does not match/)
  })

  test('needs no manifest for the committed sample', () => {
    const fixtures = tree({ 'sample/a.yml': 'a: 1\n' })
    expect(resolveCorpus('sample', fixtures).files).toBe(1)
  })

  test('rejects an unknown corpus name', () => {
    expect(() => resolveCorpus('other', tree({}))).toThrow(/unknown corpus/)
  })
})
