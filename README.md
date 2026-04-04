<!-- markdownlint-disable -->
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
bun run build:prod        # Build the app for production
```

### DEPENDENCIES

- [Git][5] - **Version control:** Manage source code history and collaboration
- [Mise][9] - **Development tools:** Manage development tools like node, python, cmake, terraform, and hundreds more
  - [Bun][6] - **Package manager:** Runtime, Package Manager, Bundler & Test Runner
    - [Biome][13] - **JavaScript / TypeScript linter:** Enforce code style and best practices
    - [Knip][14] - **Dependency analysis:** Detect unused imports, dead code, and dependencies
    - [jscpd][15] - **Copy/paste detector:** Detect duplicate code
    - [dependency-cruiser][16] - **Dependency analysis:** Validate and visualise dependencies
  - [Pre-commit][12] - **Pre-commit hooks:** Checks before committing code
  - [Hadolint][18] - **Dockerfile linter:** Enforce Dockerfile best practices
  - [Container Structure Test][19] - **Container validation:** Validate Docker image structure and behavior
- [Gitlint][11] - **Git commit message linter:** Enforce commit message conventions
- [Docker][17] - **Containerization platform:** Build, ship, and run containers

#### BUN CATALOGS

This workspace uses Bun named [catalogs][8] (`catalogs`, plural) instead of a single default catalog. The strategy is to group dependencies by role so version ownership is explicit and easy to evolve:

1. **Portability**: Every package can consume the same version contract via `catalog:<group>` without copying semver ranges.
2. **Sustainability**: Upgrades happen in one place and are naturally batched by concern (quality vs release vs types).
3. **Scalability**: New workspace packages can adopt shared standards immediately by referencing existing catalogs.

---

### DOCKER

```sh
docker pull roalcantara/kb:latest           # Pull the Docker image tagged as latest from Docker Hub
docker run --rm roalcantara/kb --help       # Run the Docker image tagged as latest as a container
docker build -t roalcantara/kb:latest .     # Build a Docker image tagged as latest for the current platform
docker push roalcantara/kb:latest           # Push the Docker image tagged as latest to [Docker Hub][19]
docker push roalcantara/kb:v1.0.0           # Push the Docker image tagged as v1.0.0 to [Docker Hub][19]
```

### [CST][18] - Container Structure Tests

[CST][18] provides a powerful framework to validate the structure of a container image.
These tests can be used to check the output of commands in an image, as well as verify metadata and contents of the filesystem.

To build an [Alpine Linux][16] image and execute the [CST][18] tests, using configuration file [tools/container-structure-test.yml](tools/container-structure-test.yml), run:

```sh
# Build the Docker image and execute the CST tests
mise run docker:test
```

#### Maintainer notes — Docker, TypeScript, and Bun

**Docker image build**

- `bun install --frozen-lockfile` in the image fails if the workspace graph does not match the repo: copy **every workspace `package.json`** (not only the root) before `bun install`. This repo uses `COPY --parents apps/*/package.json ./` so new apps under `apps/<name>/` do not require Dockerfile edits. The Dockerfile uses `# syntax=docker/dockerfile:1.20` because [`COPY --parents`][22] needs that frontend. If you add another workspace root (e.g. `packages/*`), add a matching `COPY --parents` line and extend [`.dockerignore`](.dockerignore) with the same `!packages/*/…` style as `apps/`.
- If you see `lockfile had changes, but lockfile is frozen` during `docker build`, either the context is missing workspace manifests (above) or you changed `package.json` without running `bun install` and committing [bun.lock](bun.lock).

**`.dockerignore` and `apps/*`**

- Patterns use `apps/*/…` so each workspace app is included without naming it explicitly. Nested workspaces like `apps/foo/bar` (two path segments before `package.json`) need extra rules or a flatter layout.

**TypeScript**

- Root [`tsconfig.json`](tsconfig.json) **excludes** `**/*.spec.ts` and `**/*.test.ts` so `tsc --noEmit` is application code only; specs are checked via [`tsconfig.spec.json`](tsconfig.spec.json) (whole repo) and optionally [`apps/kb/tsconfig.spec.json`](apps/kb/tsconfig.spec.json) per package (`bun run typecheck:spec` from the app). `bun build` follows the **entry import graph**, not `tsconfig` `include`, so specs are not bundled unless imported from production code.

**Bun tests**

- `describe` / `describe.each` callbacks **group** tests; only `test()` / `it()` registers a case. Put `expect()` inside `test`/`it` (see [Bun parametrized tests][20]).

**`bun build --compile` and `*.bun-build`**

- Bun may leave temporary `*.bun-build` files in the working directory ([upstream issue][21]). [`package.json`](package.json) runs that `find` after successful `build` / `build:prod` via `clean:build`; run `bun run clean:build` manually if one appears after a failed compile. [`.gitignore`](.gitignore) ignores `*.bun-build`.

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
[16]: https://github.com/sverweij/dependency-cruiser 'dependency-cruiser - Validate and visualise dependencies'
[17]: https://docker.com 'Docker - Containerization platform'
[18]: https://github.com/hadolint/hadolint 'Hadolint - Dockerfile linter'
[19]: https://github.com/GoogleContainerTools/container-structure-test 'Container Structure Test - validate the structure of your container images'
[20]: https://bun.com/docs/test/writing-tests#parametrized-tests
[21]: https://github.com/oven-sh/bun/issues/14020
[22]: https://docs.docker.com/reference/dockerfile/#copy---parents