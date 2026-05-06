# Per-action simulationResult in PolicyDiffInput instead of global

**Status:** Accepted
**Date:** May 2026

## Context

The `diffPolicies` function needs to evaluate actions against two policies. If either policy has `requireSimulation: true`, a `SimulationResult` is needed for the evaluation to be meaningful. Two options:

1. A single optional `SimulationResult` on `PolicyDiffInput` — shared across all actions.
2. Per-action `SimulationResult` — each action in the array carries its own optional simulation context.

## Decision

Per-action `SimulationResult`:

```typescript
actions: Array<{ action: Action; simulationResult?: SimulationResult }>
```

A single global `SimulationResult` assumes all actions share the same simulation context, which is not true. Different actions have different gas estimates, different execution paths, and potentially different simulation outcomes depending on chain state. Using a shared result would produce incorrect evaluations for multi-action diffs — gas buffer checks would use the wrong estimate for every action except the one that produced the simulation.

## Consequences

**Positive:** correct simulation context per action, accurate policy evaluations, no cross-action contamination of simulation data.

**Negative:** callers must provide simulation results per action if simulation checks are relevant. The `requiresSimulation` field in the `summary` block tells callers exactly how many actions were evaluated without a simulation context, making gaps visible rather than silent.
