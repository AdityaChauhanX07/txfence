# Drop 'full' from SimulationCoverageLevel — use 'basic' and 'deep' instead

**Status:** Accepted
**Date:** May 2026

## Context

The `SimulationResult` type needed a coverage level to communicate how much confidence the simulation provides. Initial design included `'full'` as a value for Tenderly simulation. Review identified that `'full'` implies a guarantee the tool cannot make — even a complete Tenderly trace cannot guarantee execution equivalence at submission time because chain state moves between simulation and signing.

## Decision

Use `'basic'` (eth_call, standard coverage) and `'deep'` (Tenderly trace, deeper coverage) instead of `'full'`. Neither value implies a guarantee. Both are honest about what they represent: a level of coverage, not a correctness certificate. The `'partial'` and `'none'` values are retained for cases where coverage is known to be incomplete (e.g., Solana simulation where full execution tracing is not available).

## Consequences

**Positive:** honest API that does not make claims the tool cannot keep. Consumers cannot over-trust simulation results based on a misleading label.

**Negative:** `'deep'` is less immediately intuitive than `'full'` at first glance. The documentation and type definitions clarify that `'deep'` means Tenderly trace coverage, not guaranteed execution equivalence.
