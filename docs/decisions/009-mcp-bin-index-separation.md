# Separate bin.ts from index.ts in @txfence/mcp

**Status:** Accepted
**Date:** May 2026

## Context

The MCP package serves two purposes: a runnable server (CLI tool) and a library (exporting `loadConfig`, `defineConfig`, `env` for use by `txfence.config.ts` files). Initially these were combined in a single `index.ts` with top-level `await` that started the server on import. This caused a critical problem: any package that imported from `@txfence/mcp` to get `loadConfig` would inadvertently start the MCP server. The `@txfence/cli` package discovered this when its commands tried to import `loadConfig` for config file loading.

## Decision

Split into two entry points:

- `src/bin.ts` — the CLI binary with top-level `await` that starts the server. This file has side effects by design.
- `src/index.ts` — pure library barrel (`loadConfig`, `defineConfig`, `env`, `envOptional`) with no side effects.

The `tsup.config.ts` builds both entry points, with the shebang banner applied only to the bin output. The `package.json` `bin` field points to `dist/bin.js`, not `dist/index.js`.

## Consequences

**Positive:** importing from `@txfence/mcp` is safe in any context. The CLI and any other package can import `loadConfig` without triggering server startup.

**Negative:** slightly more complex `tsup` configuration (two entry points). This is the standard pattern for Node.js packages that are both a library and a CLI tool — Express, Vite, and others follow the same approach.
