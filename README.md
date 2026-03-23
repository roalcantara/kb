# kb

A terminal-based personal knowledge base management system.

[![MIT license](https://img.shields.io/badge/License-MIT-brightgreen.svg?style=flat-square)](LICENSE) [![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.0-4baaaa.svg?style=flat-square)][2] [![Editor Config](https://img.shields.io/badge/Editor%20Config-1.0.1-crimson.svg?style=flat-square)][3] [![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)][4] [![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg?style=flat-square)][8] [![Biome](https://img.shields.io/badge/Biome-2.4.8-blue.svg?style=flat-square)][11]

## INSTALL

```sh
git clone https://github.com/roalcantara/kb
```

## DEVELOPMENT

### DEPENDENCIES

- [Git][5] - **Version control:** Manage source code history and collaboration
- [Mise][7] - **Development tools:** Manage development tools like node, python, cmake, terraform, and hundreds more
  - [Bun][6] - **Package manager:** Runtime, Package Manager, Bundler & Test Runner
    - [Biome][11] - **JavaScript / TypeScript linter:** Enforce code style and best practices
    - [Knip][12] - **Dependency analysis:** Detect unused imports, dead code, and dependencies
    - [jscpd][13] - **Copy/paste detector:** Detect duplicate code
    - [dependency-cruiser][14] - **Dependency analysis:** Validate and visualise dependencies
  - [Pre-commit][10] - **Pre-commit hooks:** Checks before committing code
  - [Hadolint][17] - **Dockerfile linter:** Enforce Dockerfile best practices
  - [Container Structure Test][18] - **Container validation:** Validate Docker image structure and behavior
- [Gitlint][9] - **Git commit message linter:** Enforce commit message conventions
- [Docker][15] - **Containerization platform:** Build, ship, and run containers

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

### DOCKER

```sh
docker pull roalcantara/kb:latest           # Pull the Docker image tagged as latest from Docker Hub
docker run --rm roalcantara/kb --help       # Run the Docker image tagged as latest as a container
docker build -t roalcantara/kb:latest .     # Build a Docker image tagged as latest for the current platform
docker push roalcantara/kb:latest           # Push the Docker image tagged as latest to Docker Hub
docker push roalcantara/kb:v1.0.0           # Push the Docker image tagged as v1.0.0 to Docker Hub
```

### [CST][18] - Container Structure Tests

[CST][18] provides a powerful framework to validate the structure of a container image.
These tests can be used to check the output of commands in an image, as well as verify metadata and contents of the filesystem.

To build an [Alpine Linux][16] image and execute the [CST][18] tests, using configuration file [tools/container-structure-test.yml](tools/container-structure-test.yml), run:

```sh
# Build the Docker image and execute the CST tests
mise run docker:test
```

---

## ACKNOWLEDGEMENTS

- [Standard Readme][4]

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
[7]: https://mise.jdx.dev 'Manages dev tools like node, python, cmake, terraform, and hundreds more'
[8]: https://conventionalcommits.org 'Conventional Commits'
[9]: https://jorisroovers.com/gitlint 'Git commit message linter'
[10]: https://pre-commit.com 'Framework for managing and maintaining multi-language pre-commit hooks'
[11]: https://biomejs.dev 'Biome - JavaScript / TypeScript linter'
[12]: https://github.com/webpro/knip 'Knip - Dependency analysis - Detect unused imports, dead code, and dependencies'
[13]: https://jscpd.dev 'jscpd - Copy/paste detector for source code'
[14]: https://github.com/sverweij/dependency-cruiser 'dependency-cruiser - Validate and visualise dependencies'
[15]: https://docker.com 'Docker - Containerization platform'
[16]: https://alpinelinux.org 'Alpine Linux - A minimalistic Linux distribution'
[17]: https://github.com/hadolint/hadolint 'Hadolint - Dockerfile linter'
[18]: https://github.com/GoogleContainerTools/container-structure-test 'Container Structure Test - validate the structure of your container images'