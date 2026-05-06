# Cancel on timeout is a hard default for human approval, not configurable

**Status:** Accepted
**Date:** May 2026

## Context

When a human approval window expires without a response, two behaviors are possible:

1. Default to execute — the agent proceeds. Simpler for teams that trust their agents.
2. Default to cancel — the transaction is dropped. The agent must handle the rejection.

Some approval implementations allow this behavior to be configured per agent or per transaction.

## Decision

Cancel on timeout is a hard default and is not configurable to execute-on-timeout. In financial operations, the absence of approval is not approval. An approval system that defaults to execute on timeout defeats its own purpose — a compromised or unavailable approver would result in unlimited execution. The cost of a missed transaction is recoverable. The cost of an unauthorized transaction may not be. This is the same reasoning as `dryRun: true` in the MCP server — when in doubt, stop.

## Consequences

**Positive:** the approval system provides real protection even under adverse conditions such as approver unavailability, network partition, or key compromise. Agents cannot be unblocked by simply waiting out the approval window.

**Negative:** agents must explicitly handle `approval_timeout` in their result handling. This is correct behavior — an agent that cannot handle a timeout gracefully should not be operating autonomously on capital.
