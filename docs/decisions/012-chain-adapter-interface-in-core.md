# Define ChainAdapter interface in @txfence/core rather than importing viem

**Status:** Accepted
**Date:** May 2026

## Context

The policy engine and agent orchestration in `@txfence/core` need to call chain adapters for simulation. Two options:

1. Import viem types directly into core — couples core to EVM specifics and forces all consumers to install viem.
2. Define a minimal `ChainAdapter` interface in core that EVM, Solana, and Cosmos adapters implement — core stays chain-agnostic.

## Decision

Define `ChainAdapter` in core. The core package is the dependency that every other package imports. If core depended on viem, every consumer of core would transitively depend on viem regardless of which chains they use. A Cosmos-only team would be forced to install EVM libraries. The interface approach keeps core dependency-light and lets each chain adapter package own its chain-specific dependencies.

## Consequences

**Positive:** core has no chain-specific dependencies. Consumers install only what they use — a Solana-only deployment has no EVM library overhead. The pattern also makes it straightforward to add future chain adapters without touching core.

**Negative:** TypeScript structural typing means any object with the right shape satisfies `ChainAdapter` — there is no nominal type check at the boundary. This is acceptable and is the standard pattern for dependency injection in TypeScript. Runtime errors from mismatched adapters surface immediately in tests.
