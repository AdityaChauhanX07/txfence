# dryRun defaults to true in txfence_submit MCP tool

**Status:** Accepted
**Date:** May 2026

## Context

The `txfence_submit` MCP tool runs the full pipeline including optional execution. An AI assistant calling this tool could accidentally trigger a real on-chain transaction if execution were the default. Two options:

1. Default to execute — simpler API, matches the literal intent of "submit".
2. Default to dry run — requires explicit opt-in to execute real transactions.

## Decision

Default to `dryRun: true`. The MCP server is invoked by AI assistants operating on behalf of users. Accidental execution of a real transaction is an irreversible harm. The safe default must be the one that requires explicit human opt-in to cause irreversible effects. This mirrors the cancel-on-timeout default for human approval — in both cases, the safe action when uncertain is to stop, not to proceed.

## Consequences

**Positive:** accidental on-chain execution is impossible without an explicit `dryRun: false`. AI assistants exploring the API cannot cause unintended transactions.

**Negative:** slightly more verbose for callers who always want execution. The dry run result shows exactly what would happen, making the two-step pattern (dry run, then confirm with `dryRun: false`) natural and auditable.
