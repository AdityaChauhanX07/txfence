# Use tsup for the build pipeline instead of raw tsc

**Status:** Accepted
**Date:** May 2026

## Context

Building a TypeScript monorepo requires compiling source to JavaScript with declaration files. Options considered:

1. Raw `tsc` — standard, no extra dependencies, full control.
2. `tsup` — wraps esbuild, handles ESM output, declaration files, and source maps in a single command with minimal configuration.
3. Rollup/Webpack — overpowered for a library build.

## Decision

Use tsup. For a library monorepo with 12+ packages all following the same build pattern, tsup reduces per-package build configuration to a 10-line `tsup.config.ts`. Raw `tsc` requires careful `tsconfig` management across packages for declaration emit, path resolution, and composite builds. tsup handles all of this with sensible defaults. The esbuild performance is a bonus.

## Consequences

**Positive:** minimal per-package build configuration, fast builds via esbuild, correct ESM output with source maps and declaration files out of the box.

**Negative:** additional dependency. tsup is widely used and actively maintained. If tsup is ever abandoned, migration to raw `tsc` or another bundler is mechanical — the build contract (ESM output, `.d.ts` files, source maps) is the same regardless of tool.
