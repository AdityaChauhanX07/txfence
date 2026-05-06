# Declarative action graph (Philosophy B) over intent-based abstraction

**Status:** Accepted
**Date:** May 2026

## Context

Two API philosophies were considered for how agents declare what they want to do:

**Philosophy A (intent-based):** `agent.execute({ intent: 'swap 100 USDC to ETH at best price' })` — the SDK interprets, routes, and constructs the transaction. Higher abstraction, more magic, harder to audit.

**Philosophy B (declarative):** `agent.submit(swap({ from: USDC(100), to: ETH, via: router() }))` — explicit, composable, auditable. No hidden routing. Every action inspectable before execution.

## Decision

Philosophy B. txfence is built for institutional-grade consumers where a mistake means real capital at risk. Hidden routing and inferred parameters are footguns in this context. Every action must be inspectable before execution. The audit trail requirement reinforces this — you cannot produce a meaningful audit record of an action whose parameters were inferred rather than declared. The higher verbosity is a feature, not a bug, for this audience.

## Consequences

**Positive:** every action is fully auditable, no hidden behavior, policy evaluation is deterministic given the declared action, and `diffPolicies` can reason about actions precisely.

**Negative:** more verbose than intent-based APIs. Teams who want magic will find txfence frustrating. This is intentional — they are not the target audience.
