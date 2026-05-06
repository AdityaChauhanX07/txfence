# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for txfence. Each file documents a significant design decision made during the build: what problem was being solved, what options existed, what was chosen, and what the consequences are.

## Format

Each ADR follows this structure:

```
# Title

**Status:** Accepted
**Date:** Month Year

## Context
What problem were we solving, and what options existed.

## Decision
What we chose and why.

## Consequences
What this enables, and what it costs or constrains.
```

## Index

| # | Decision |
|---|---|
| [001](001-ioredis-over-redis-client.md) | Use ioredis over the official redis client for Redis cap locking |
| [002](002-block-scanning-over-eth-getlogs.md) | Use block scanning over eth_getLogs for the on-chain monitor |
| [003](003-policy-snapshot-clone-in-record.md) | Deep clone policySnapshot inside AuditLog.record() not at the call site |
| [004](004-mcp-dry-run-default.md) | dryRun defaults to true in txfence_submit MCP tool |
| [005](005-declarative-action-graph.md) | Declarative action graph over intent-based abstraction |
| [006](006-cancel-on-timeout-hard-default.md) | Cancel on timeout is a hard default for human approval |
| [007](007-tsup-over-tsc.md) | Use tsup for the build pipeline instead of raw tsc |
| [008](008-better-sqlite3-over-sqljs.md) | Use better-sqlite3 over sql.js for SQLite storage |
| [009](009-mcp-bin-index-separation.md) | Separate bin.ts from index.ts in @txfence/mcp |
| [010](010-per-action-simulation-result.md) | Per-action simulationResult in PolicyDiffInput instead of global |
| [011](011-dropping-full-coverage-level.md) | Drop 'full' from SimulationCoverageLevel |
| [012](012-chain-adapter-interface-in-core.md) | Define ChainAdapter interface in @txfence/core rather than importing viem |

## Adding a new ADR

1. Copy the format above.
2. Increment the number from the last entry.
3. Name the file `NNN-short-description.md`.
4. Add a row to the index above.

These records exist because the reasoning behind these decisions would otherwise live only in conversation history. Code shows what was built; ADRs explain why.
