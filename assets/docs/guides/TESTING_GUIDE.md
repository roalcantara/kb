---
title: Testing guidelines
description: Bun test runner, factories, table-driven tests, FCIS-friendly patterns
---

# Testing Guidelines

Cursor rule (detailed patterns): `.cursor/rules/testing.mdc`

## Bun: nested `describe` (no `context`)

`bun:test` exports **`describe`** (and `it`, `expect`, …) but **not** RSpec’s `context`. **Do not** alias (`const context = describe`); that adds noise. Use **nested `describe` blocks** for situation groups (“when …”, “with …”). Same structure as Better Specs “contexts”, one API only.

## Core Principles

1. Write unit tests for all public functions and classes
2. Use table-driven tests for functions with multiple cases (reduces duplication)
3. Test edge cases: undefined values, empty inputs, boundary conditions
4. Test error paths explicitly (all error branches validated)
5. Use Bun's built-in test runner - no Jest, no Vitest
6. No mocking - use dependency injection with real implementations
7. Use in-memory SQLite (`:memory:`) for all DB tests - never the real DB
8. Keep tests minimal and focused (one behavior per test)
9. Achieve and maintain ≥80% code coverage

## ❌ Sparingly Use Mocking Policy

The codebase is designed around Dependency Injection. This means that we should avoid mocking unless absolutely necessary.

- **Never** use `mock()`, `spyOn()`, or module mocking for unit tests unless absolutely necessary
- Instantiate real adapters with an in-memory DB or test doubles
- If a piece of code is hard to test without mocking, it needs to be refactored

```typescript
// ✅ Correct - real SQLite in memory (paths illustrative — align with your module layout)
import { Database } from "bun:sqlite";
import { SQLiteRepository } from "../src/adapters/SQLiteRepository";

const db = new Database(":memory:");
const repo = new SQLiteRepository(db);

// ❌ Wrong - mocking the module
import { mock } from "bun:test";
mock.module("../src/adapters/SQLiteRepository", () => ({ ... }));
```

## Recommended Patterns

### Table-Driven Tests

```typescript
import { describe, expect, it } from "bun:test";
import { normalizeLinks } from "../src/domain/normalizeLinks";

describe("normalizeLinks", () => {
  const cases = [
    {
      name: "single URL string",
      input: "https://example.com",
      want: [{ title: "https://example.com", url: "https://example.com" }],
    },
    {
      name: "array of URLs",
      input: ["https://a.com", "https://b.com"],
      want: [
        { title: "https://a.com", url: "https://a.com" },
        { title: "https://b.com", url: "https://b.com" },
      ],
    },
    {
      name: "empty array",
      input: [],
      want: [],
    },
  ];

  for (const { name, input, want } of cases) {
    it(name, () => {
      expect(normalizeLinks(input)).toEqual(want);
    });
  }
});
```

### In-Memory SQLite Tests

```typescript
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { SQLiteRepository } from "../src/adapters/SQLiteRepository";

describe("SQLiteRepository", () => {
  let db: Database;
  let repo: SQLiteRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    // Run schema migrations on the in-memory DB
    db.run(`CREATE TABLE IF NOT EXISTS knowledges ( ... )`);
    repo = new SQLiteRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it("returns empty array when no entries exist", async () => {
    const result = await repo.find({ limit: 50, offset: 0 });
    expect(result.entries).toEqual([]);
    expect(result.total).toBe(0);
  });
});
```

### Error Path Testing

```typescript
import { expect, it } from "bun:test";
import { GetEntry } from "../src/application/usecases/GetEntry";

it("throws user error when entry not found", async () => {
  const usecase = new GetEntry(repo);
  await expect(usecase.execute(99999)).rejects.toMatchObject({
    exitCode: 1, // user error
  });
});
```

### Dependency Injection in Tests

```typescript
import { describe, it, expect } from "bun:test";
import { ActOnEntry } from "../src/application/usecases/ActOnEntry";
import { InMemoryClipboard } from "./helpers/InMemoryClipboard";

// Test double - a real implementation for tests, not a mock
class InMemoryClipboard implements Clipboard {
  public lastCopied: string | null = null;
  async copy(text: string) { this.lastCopied = text; }
}

describe("ActOnEntry", () => {
  it("copies command to clipboard for Command entries", async () => {
    const clipboard = new InMemoryClipboard();
    const usecase = new ActOnEntry(repo, clipboard, browser);

    await usecase.execute(commandEntryId);

    expect(clipboard.lastCopied).toBe("ls -la");
  });
});
```

### [Better Specs][3] Guidelines

Better Specs is a collection of best practices for writing high-quality tests. These guidelines should be followed for all test files in this project.

#### Core Principles

##### 1. Describe Your Methods

Be clear about what you are describing:
- Use `.` or `::` for class methods
- Use `#` for instance methods

```typescript
// ✅ Good
describe('.create', () => {
  // class method tests
})

describe('#validate', () => {
  // instance method tests
})

// ❌ Bad
describe('create', () => {
  // unclear if class or instance method
})
```

##### 2. Use nested `describe` for situations

Nested groups make tests clear. Start inner `describe` names with 'when', 'with', or 'without'.

```typescript
// ✅ Good
describe('#destroy', () => {
  describe('when resource is found', () => {
    it('deletes the resource', () => {})
  })

  describe('when resource is not found', () => {
    it('returns 404', () => {})
  })
})

// ❌ Bad
describe('#destroy', () => {
  it('deletes the resource when found', () => {})
  it('returns 404 when not found', () => {})
})
```

##### 3. Keep Descriptions Short

Spec descriptions should never be longer than 40 characters. If longer, split using another nested `describe`.

```typescript
// ✅ Good
describe('when authenticated', () => {
  it('returns user data', () => {})
})

// ❌ Bad
it('returns user data when the user is authenticated', () => {})
```

##### 4. Single Expectation Per Test

Each test should make only one assertion. This helps identify errors quickly and keeps code readable.

**Exception**: Integration tests that are slow to set up can have multiple expectations to avoid performance hits.

```typescript
// ✅ Good (unit test)
it('validates presence of name', () => {
  expect(user.validate()).toBe(false)
})

it('adds error message', () => {
  user.validate()
  expect(user.errors).toContain('Name is required')
})

// ✅ Acceptable (integration test with expensive setup)
it('creates user with all attributes', async () => {
  const user = await createUser()
  expect(user.id).toBeDefined()
  expect(user.name).toBe('John')
  expect(user.email).toBe('john@example.com')
})
```

##### 5. Test All Possible Cases

Test valid, edge, and invalid cases. Think of all possible inputs.

```typescript
describe('#destroy', () => {
  describe('when resource exists', () => {
    describe('when user owns resource', () => {
      it('deletes the resource', () => {})
    })

    describe('when user does not own resource', () => {
      it('returns 403 forbidden', () => {})
    })
  })

  describe('when resource does not exist', () => {
    it('returns 404 not found', () => {})
  })
})
```

##### 6. Use Subject

If you have several tests related to the same subject, use `subject` to DRY them up.

```typescript
// ✅ Good
describe('User', () => {
  subject(() => new User({ name: 'John', email: 'john@example.com' }))

  it('has a name', () => {
    expect(subject().name).toBe('John')
  })

  it('has an email', () => {
    expect(subject().email).toBe('john@example.com')
  })
})

// ❌ Bad
describe('User', () => {
  it('has a name', () => {
    const user = new User({ name: 'John', email: 'john@example.com' })
    expect(user.name).toBe('John')
  })

  it('has an email', () => {
    const user = new User({ name: 'John', email: 'john@example.com' })
    expect(user.email).toBe('john@example.com')
  })
})
```

##### 7. Don't Use "should" in Descriptions

Use third person present tense. Describe what the code **does**, not what it **should do**.

```typescript
// ✅ Good
it('creates a new user', () => {})
it('validates email format', () => {})
it('returns 404 when not found', () => {})

// ❌ Bad
it('should create a new user', () => {})
it('should validate email format', () => {})
it('should return 404 when not found', () => {})
```

##### 8. Create Only the Data You Need

Don't load more data than needed. If you think you need dozens of records, you're probably wrong.

```typescript
// ✅ Good
it('finds user by email', () => {
  const user = createUser({ email: 'test@example.com' })
  expect(findByEmail('test@example.com')).toEqual(user)
})

// ❌ Bad
it('finds user by email', () => {
  const users = createUsers(100) // unnecessary data
  const user = users[0]
  expect(findByEmail(user.email)).toEqual(user)
})
```

##### 9. Use Factories, Not Fixtures

Use factories to reduce verbosity when creating test data. They're easier to control than fixtures.

```typescript
// ✅ Good
import { factory_for } from '@tests'
const user = factory_for('user', { role: 'admin' })

// ❌ Bad
const user = fixtures.users.admin // hard to customize
```

##### 10. Use Readable Matchers

Use clear, expressive matchers that make tests easy to understand.

```typescript
// ✅ Good
expect(user.name).toBe('John')
expect(users).toHaveLength(3)
expect(response.status).toBe(200)

// ❌ Bad
expect(user.name === 'John').toBe(true)
expect(users.length === 3).toBe(true)
```

##### 11. Mock Sparingly

Don't overuse mocks. Test real behavior when possible. Mocking makes specs faster but harder to maintain.

Use mocks for:
- External services (HTTP requests, third-party APIs)
- Slow operations (database queries in unit tests)
- Non-deterministic behavior (random values, timestamps)

Avoid mocks for:
- Internal application logic
- Simple functions
- Domain models

##### 12. Test What You See

Focus on:
- **Models**: Deep testing of business logic
- **Integration tests**: Test user-visible behavior
- **Controllers**: Minimal testing (covered by integration tests)

Don't add useless complexity testing controllers separately if integration tests cover the behavior.

#### Project-Specific Guidelines

##### TypeScript/Bun Testing

```typescript
import { describe, it, expect, beforeEach } from 'bun:test'

describe('DocumentValidator', () => {
  let subject: DocumentValidator

  beforeEach(() => {
    subject = new DocumentValidator()
  })

  describe('#validate', () => {
    describe('when document is valid', () => {
      it('returns true', () => {
        expect(subject.validate(validDoc)).toBe(true)
      })
    })

    describe('when document is invalid', () => {
      it('returns false', () => {
        expect(subject.validate(invalidDoc)).toBe(false)
      })

      it('adds error message', () => {
        subject.validate(invalidDoc)
        expect(subject.errors).toContain('Invalid format')
      })
    })
  })
})
```

#### Summary Checklist

- [ ] Use `.` for class methods, `#` for instance methods in descriptions
- [ ] Use nested `describe` names starting with 'when', 'with', or 'without'
- [ ] Keep descriptions under 40 characters
- [ ] One expectation per test (except slow integration tests)
- [ ] Test valid, edge, and invalid cases
- [ ] Use `subject` to DRY up related tests
- [ ] **Never use "should" in test descriptions**
- [ ] Use third person present tense
- [ ] Create only necessary test data
- [ ] Use factories instead of fixtures
- [ ] Use readable matchers
- [ ] Mock sparingly, test real behavior
- [ ] Focus on models and integration tests

## Enforcement

The "Enforce DRY Code Principles" hook will also check for Better Specs compliance during code reviews.

## File Structure

Tests live next to the source files they test:

```
src/
  domain/
    normalizeLinks.ts
    normalizeLinks.test.ts
  adapters/
    SQLiteRepository.ts
    SQLiteRepository.test.ts
  application/
    usecases/
      GetEntry.ts
      GetEntry.test.ts
```

## Running Tests

```bash
# All tests
bun run test

# Watch mode
bun run test:watch
```

## References

- [Bun Test Runner][0]
- [Bun Test Matchers][1]
- [Dependency Injection pattern][2]
- [Better Specs Guide][3]

[0]: https://bun.sh/docs/test 'Bun Test Runner'
[1]: https://bun.sh/docs/test/writing 'Bun Test Matchers'
[2]: https://en.wikipedia.org/wiki/Dependency_injection 'Dependency Injection pattern'
[3]: https://betterspecs.org 'Better Specs Guide'
