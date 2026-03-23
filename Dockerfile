# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# kb — multi-stage Dockerfile
#
# STAGES:
#   builder → oven/bun:1-alpine AS builder, compiles the kb binary
#   final   → alpine:3 with only the compiled binary
# USAGE:
#   docker build -t roalcantara/kb:latest .             # Build the image locally
#   docker run --rm roalcantara/kb --help               # Run the image with the default command
#   docker run --rm roalcantara/kb greet World          # Run the image with a custom command
#   docker push roalcantara/kb:latest                   # Push the image to Docker Hub
#   docker push roalcantara/kb:v1.0.0                   # Push the image to Docker Hub with a specific version
# REFERENCES:
# https://bunli.dev/docs/guides/distribution#4-docker-distribution
# ─────────────────────────────────────────────────────────────────────────────

# ── STAGE 1: builder ──────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS builder
WORKDIR /app
# Copy lockfile and manifest first for better layer caching —
# this layer only busts when dependencies change, not on source edits.
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
COPY . .
# Compile to a self-contained binary — no bun runtime needed in the final image.
RUN bun build index.ts \
       --bytecode --minify --sourcemap \
        --no-compile-autoload-dotenv \
        --no-compile-autoload-bunfig \
        --compile \
        --outfile dist/kb

# ── STAGE 2: final ────────────────────────────────────────────────────────────
FROM alpine:3 AS final
WORKDIR /app
RUN apk add --no-cache libstdc++
COPY --from=builder /app/dist/kb /usr/local/bin/kb

LABEL org.opencontainers.image.title="kb"
LABEL org.opencontainers.image.description="KodexB - Personal Knowledge Base"
LABEL org.opencontainers.image.source="https://github.com/roalcantara/kb"

ENTRYPOINT ["kb"]