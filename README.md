# kb

[![Review](https://github.com/roalcantara/kb/actions/workflows/review.yml/badge.svg)](https://github.com/roalcantara/kb/actions/workflows/review.yml) [![Release](https://github.com/roalcantara/kb/actions/workflows/release.yml/badge.svg)](https://github.com/roalcantara/kb/actions/workflows/release.yml) [![Publish](https://github.com/roalcantara/kb/actions/workflows/publish.yml/badge.svg)](https://github.com/roalcantara/kb/actions/workflows/publish.yml)

A terminal-based personal knowledge base management system.

[![MIT license](https://img.shields.io/badge/License-MIT-brightgreen.svg?style=flat-square)](LICENSE) [![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.0-4baaaa.svg?style=flat-square)][2] [![Editor Config](https://img.shields.io/badge/Editor%20Config-1.0.1-crimson.svg?style=flat-square)][3] [![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)][4] [![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg?style=flat-square)][8] [![Biome](https://img.shields.io/badge/Biome-2.4.8-blue.svg?style=flat-square)][11] [![Renovate](https://img.shields.io/badge/Renovate-blue.svg?style=flat-square)][30]

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
  - [Typia][32] - **Runtime validation:** AOT-generated validators from TypeScript types
  - [Pre-commit][10] - **Pre-commit hooks:** Checks before committing code
  - [Hadolint][17] - **Dockerfile linter:** Enforce Dockerfile best practices
  - [Container Structure Test][18] - **Container validation:** Validate Docker image structure and behavior
  - [DevContainers][31] - **Container development platform:** Build, ship, and run containers
- [Renovate][30] - **Automated dependency updates:** Keep dependencies up to date
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
bun run generate:typia    # Regenerate Typia validators (tools/typia/templates → tools/typia/generated)
```

### TYPIA

This project uses [Typia][32] in **generation mode**: validator templates live under [`tools/typia/templates/`](tools/typia/templates/), and `bun run generate:typia` writes the compiled validators to [`tools/typia/generated/`](tools/typia/generated/) (tracked in git). After you change a type or a template, run `generate:typia` again. See the [Typia setup guide](https://typia.io/docs/setup/#generation) for details.

### DOCKER

```sh
docker pull roalcantara/kb:latest           # Pull the Docker image tagged as latest from Docker Hub
docker run --rm roalcantara/kb --help       # Run the Docker image tagged as latest as a container
docker build -t roalcantara/kb:latest .     # Build a Docker image tagged as latest for the current platform
docker push roalcantara/kb:latest           # Push the Docker image tagged as latest to [Docker Hub][19]
docker push roalcantara/kb:v1.0.0           # Push the Docker image tagged as v1.0.0 to [Docker Hub][19]
```

### DEVCONTAINERS

```bash
devcontainer up                                   # ==> Create and run dev container
devcontainer set-up                               # ==> Set up an existing container as a dev container
devcontainer run-user-commands                    # ==> Run user commands
devcontainer read-configuration                   # ==> Read configuration
devcontainer outdated                             # ==> Show current and available versions
devcontainer upgrade                              # ==> Upgrade lockfile
devcontainer features                             # ==> Features commands
devcontainer templates                            # ==> Templates commands
devcontainer exec <cmd> [args..]                  # ==> Execute a command on a running dev container
devcontainer build [path]                         # ==> Build a dev container image

# ==> Build a dev container image with a specific image name and platform and push it to the registry
devcontainer build --image-name roalcantara/kb:latest --platform "linux/arm64" --workspace-folder .

# ==> Build a dev container image with a specific image name and platforms and push it to the registry
devcontainer build --image-name roalcantara/kb:latest --platform "linux/arm64,linux/amd64" --push true --workspace-folder .
```

### [CST][18] - Container Structure Tests

[CST][18] provides a powerful framework to validate the structure of a container image.
These tests can be used to check the output of commands in an image, as well as verify metadata and contents of the filesystem.

To build an [Alpine Linux][16] image and execute the [CST][18] tests, using configuration file [tools/container-structure-test.yml](tools/container-structure-test.yml), run:

```sh
# Build the Docker image and execute the CST tests
mise run docker:test
```

### CI/CD

A Review pipeline that takes every pull request from code review to a published [Docker image][19] while the Release pipeline takes care of the version and changelog.

#### Workflows

##### 1. [Review](.github/workflows/review.yml) — Lint, test, build and provide a Reviewable image per Pull Request

Triggered on every non-draft PR targeting `main` is opened, updated, or marked ready for review, executes the following steps:

1. Runs the linters in a single step, publishes and uploads the results as a workflow artifact
2. Runs the full test suite, publishes and uploads the results as a workflow artifact
3. Runs the [Container Structure Test][18], publishes and uploads the results as a workflow artifact
4. Builds a multi-arch Docker image (`linux/amd64`, `linux/arm64`) tagged `pr-<number>-<short-sha>`, pushes it to DockerHub and updates the [Review Environment][22] URL
5. Posts (or updates) a PR comment with a summary of all results collected during the workflow run

> **NOTES:**
>
> - GITHUB ACTION SECRETS:
>   - [GITHUB_TOKEN][20]: required for authentication
>   - [DOCKERHUB_TOKEN][21]: required for pushing the Docker image to Docker Hub
> - GITHUB ACTION PERMISSIONS: `contents:read`, `pull-requests:write`, `deployments:write`

##### 2. [Release](.github/workflows/release.yml) — version and changelog

Triggered on every push to `main`, it uses [release-it][23] with [@release-it/conventional-changelog][24] to orchestrate the following steps:

1. Ensures that only the squash-and-merge merge strategy is used.
2. Determines the next [version][25] from [Conventional Commits][8], bumps `package.json`, and updates `CHANGELOG.md`.
3. Configures SSH commit signing, runs a full signing verification for commit and tag and pushes them to the repository
4. Creates a draft [GitHub Release][26] with the generated release notes
5. Polls the GitHub API until the draft is confirmed visible

> **NOTES:**
>
> - GITHUB ACTION SECRETS:
>   - [GH_TOKEN][27]: required when branch protection is enabled on main
>   - [RELEASE_SIGNING_SSH_KEY][28]: required for SSH commit signing
> - GITHUB ACTION VARIABLES:
>   - RELEASE_SIGNING_SIGNER_PUB: required for SSH commit signing
>   - RELEASE_GIT_USER_NAME: required for SSH commit signing
>   - RELEASE_GIT_USER_EMAIL: required for SSH commit signing
> - GITHUB ACTION PERMISSIONS: `contents:write`, `issues:write`, `pull-requests:write`, `id-token:write`

##### 3. [Publish](.github/workflows/publish.yml) — binaries and Docker image

Triggered when the [Release](.github/workflows/release.yml) workflow completes (or manually via `workflow_dispatch`), it executes the following steps:

1. Picks up the release tag from the latest draft release.
2. Cross-compiles a self-contained binary per platform, packages each one as `.tar.gz`, attests them with a build-provenance [attestation][29], and uploads them as a workflow artifact
3. Generates and attests a `sha256sum checksums.txt` from all binary artifacts, and uploads it as a workflow artifact
4. Attaches all `.tar.gz` and `checksums.txt` assets to the release and verifies their attestations
5. Builds a multi-platform image, pushes it to DockerHub and attests the container image
6. Verifies the release and the container image attestations, appends installation and usage instructions to the release notes and publishes the release
7. Updates the [Production Environment][22] URL

> **NOTES:**
>
> - GITHUB ACTION SECRETS:
>   - [GH_TOKEN][27]: required when branch protection is enabled on main
>   - [DOCKERHUB_TOKEN][21]: required for pushing the Docker image to Docker Hub
> - GITHUB ACTION PERMISSIONS: `contents:write`, `packages:write`, `id-token:write`, `attestations:write`

---

## ACKNOWLEDGEMENTS

- [Standard Readme][4]
- [Fishery][33] - Test data factories for TypeScript

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
[19]: https://hub.docker.com/repository/docker/roalcantara/kb 'Docker Hub repository for the kb image'
[20]: https://docs.github.com/actions/security-guides/automatic-token-authentication 'Automatic token authentication - GitHub Actions'
[21]: https://docs.docker.com/docker-hub/access-tokens 'Docker Hub access tokens'
[22]: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments 'Deployments and Environments - GitHub Actions'
[23]: https://github.com/release-it/release-it 'release-it - Release It!'
[24]: https://github.com/release-it/conventional-changelog 'Release It! Conventional Changelog Plugin'
[25]: https://semver.org 'SemVer - Semantic Versioning'
[26]: https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases 'GitHub Releases'
[27]: https://github.com/release-it/release-it/blob/main/docs/ci.md#github-actions 'GitHub Actions - release-it'
[28]: https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification 'About commit signature verification - GitHub'
[29]: https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations 'Use artifact attestations - GitHub Actions'
[30]: https://renovatebot.com 'Renovate - Automated dependency updates'
[31]: http://containers.dev 'Containers.dev - Container development platform'
[32]: https://typia.io 'Typia — transform TypeScript types into runtime validators'
[33]: https://fishery.dev 'Fishery - Test data factories for TypeScript'
