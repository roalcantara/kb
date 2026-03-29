---
title: Bun runtime reference
description: YAML, JSON5, file I/O, SQLite, tests — quick API notes for this repo
---

# Bun Runtime Reference

Quick reference for Bun APIs you may use in this project. Full docs: [bun.com/docs](https://bun.com/docs).

Project convention: prefer Bun over Node/npm/Vite (see `.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc`).

## YAML

**Native import** — no path resolution or async loading:

```ts
import config from './config.yaml'
console.log(config.database.host) // parsed at import time
```

**Parse/stringify**:

```ts
Bun.YAML.parse(string)   // parse YAML string → object
Bun.YAML.stringify(obj, null, 2)  // object → YAML string
```

- Supports hot reload: `bun --hot`
- Bundler parses at build time (zero runtime overhead)
- Docs: https://bun.com/docs/runtime/yaml

## JSON5

**Native import** — same as YAML:

```ts
import config from './config.json5'
const config = require('./config.json5')
const config = await import('./config.json5')
```

**Parse/stringify**:

```ts
Bun.JSON5.parse(string)
Bun.JSON5.stringify(obj, null, 2)
```

- Supports comments, trailing commas, unquoted keys
- Docs: https://bun.com/docs/runtime/json5

## File I/O

```ts
Bun.file(path).exists()     // Promise<boolean>
Bun.file(path).text()       // Promise<string>
Bun.write(path, content)    // Promise<number>
```

## SQLite

```ts
import { Database } from 'bun:sqlite'
const db = new Database(':memory:')  // or path to .sqlite
```

## Test Runner

```ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
```

## Shell

```ts
import { $ } from 'bun'
const proc = await $`command args`.quiet()
proc.exitCode
proc.stdout.toString()
```

## Environment

```ts
process.env.VAR
process.cwd()
import.meta.dir  // directory of current module (for path resolution)
```
