# kb

A terminal-based personal knowledge base management system.

[![MIT license](https://img.shields.io/badge/License-MIT-brightgreen.svg?style=flat-square)](LICENSE) [![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.0-4baaaa.svg?style=flat-square)][2] [![Editor Config](https://img.shields.io/badge/Editor%20Config-1.0.1-crimson.svg?style=flat-square)][3] [![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)][4] [![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg?style=flat-square)][10] [![Biome](https://img.shields.io/badge/Biome-blue.svg?style=flat-square)][13]

## INSTALL

```sh
git clone https://github.com/roalcantara/kb
```

## DEVELOPMENT

### USAGE

```sh
bun install               # Install dependencies
bun run index.ts          # Run the app
bun run dev               # Run the app in dev mode
bun run dev:watch         # Run the app in dev mode with hot reloading
bun run test              # Run tests
bun run test:watch        # Run tests with hot reloading
bun run lint              # Run linting
bun run lint:fix          # Fix lint errors
bun run build             # Build the app
```

### DEPENDENCIES

- [Git][5] - **Version control:** Manage source code history and collaboration
- [Mise][9] - **Development tools:** Manage development tools like node, python, cmake, terraform, and hundreds more
  - [Bun][6] - **Package manager:** Runtime, Package Manager, Bundler & Test Runner
    - [Biome][13] - **JavaScript / TypeScript linter:** Enforce code style and best practices
    - [Knip][14] - **Dependency analysis:** Detect unused imports, dead code, and dependencies
    - [jscpd][15] - **Copy/paste detector:** Detect duplicate code
  - [Pre-commit][12] - **Pre-commit hooks:** Checks before committing code
- [Gitlint][11] - **Git commit message linter:** Enforce commit message conventions

#### BUN CATALOGS

This workspace uses Bun named [catalogs][8] (`catalogs`, plural) instead of a single default catalog. The strategy is to group dependencies by role so version ownership is explicit and easy to evolve:

1. **Portability**: Every package can consume the same version contract via `catalog:<group>` without copying semver ranges.
2. **Sustainability**: Upgrades happen in one place and are naturally batched by concern (quality vs release vs types).
3. **Scalability**: New workspace packages can adopt shared standards immediately by referencing existing catalogs.

---

## ACKNOWLEDGEMENTS

- [Standard Readme][4]
- [Bun Workspaces][7]

---

## CONTRIBUTING

- Bug reports and pull requests are welcome on [GitHub][0]
- Do follow [Editor Config][3] rules.
- Everyone interacting in the project's codebases, issue trackers, chat rooms and mailing lists is expected to follow the [Contributor Covenant][2] code of conduct.

---

## LICENSE

The project is available as open source under the terms of the [MIT][1] [License](LICENSE)

[0]: https://github.com/roalcantara/kb 'Yet another terminal-based knowledge base management system'
[1]: https://opensource.org/licenses/MIT 'Open Source Initiative'
[2]: https://contributor-covenant.org 'A Code of Conduct for Open Source Communities'
[3]: https://editorconfig.org 'EditorConfig'
[4]: https://github.com/RichardLitt/standard-readme 'Standard Readme'
[5]: https://git-scm.com 'Distributed version control system'
[6]: https://bun.com 'Bun - Runtime / Package Manager / Bundler / Test Runner'
[7]: https://bun.com/docs/pm/workspaces 'Bun Workspaces'
[8]: https://bun.com/docs/pm/catalogs 'Bun Catalogs'
[9]: https://mise.jdx.dev 'Manages dev tools like node, python, cmake, terraform, and hundreds more'
[10]: https://conventionalcommits.org 'Conventional Commits'
[11]: https://jorisroovers.com/gitlint 'Git commit message linter'
[12]: https://pre-commit.com 'Framework for managing and maintaining multi-language pre-commit hooks'
[13]: https://biomejs.dev 'Biome - JavaScript / TypeScript linter'
[14]: https://github.com/webpro/knip 'Knip - Dependency analysis - Detect unused imports, dead code, and dependencies'
[15]: https://github.com/kucherenko/jscpd 'jscpd - Copy/paste detector - Detect duplicate code'