# Contributing to txfence

## Setup

Requires Node.js 20+ and pnpm 9+.

```bash
git clone https://github.com/AdityaChauhanX07/txfence.git
cd txfence
pnpm install
```

## Project structure
packages/
core/         policy engine, agent orchestration, cap locking, receipt storage
evm/          EVM chain adapter (Ethereum, Arbitrum, Optimism, Base)
solana/       Solana chain adapter
redis/        Redis-backed cap lock provider
mcp/          MCP server
cli/          command-line interface
react/        React hooks
integration/  Anvil integration tests (not published)
docs/
failure-taxonomy.md
technical-essay.md
examples/
evm-swap.ts

## Development workflow

Run all tests:
```bash
pnpm test
```

Run tests for a specific package:
```bash
cd packages/core && pnpm test
```

Build all packages:
```bash
pnpm build
```

Type check a specific package:
```bash
cd packages/core && npx tsc --noEmit
```

## Running integration tests

Integration tests require a local Anvil node. Install Foundry, then:

```bash
anvil --fork-url https://ethereum.publicnode.com --port 8545 --host 0.0.0.0 --block-time 1
```

In a separate terminal:
```bash
cd packages/integration && pnpm test
```

## Adding a new chain adapter

1. Create `packages/{chain}/` following the structure of `packages/evm/`
2. Implement `simulate{Chain}Action` matching the `ChainAdapter` interface from `@txfence/core`
3. Implement `execute{Chain}Action` and a signer helper
4. Export everything from `src/index.ts`
5. Add the package to `pnpm-workspace.yaml`

## Before submitting a PR

- All tests pass: `pnpm test`
- No type errors: type check the packages you modified
- New code has tests
- New public APIs are exported from `src/index.ts`

## Design principles

txfence makes hard, opinionated calls. Before proposing a change to core behavior, read `docs/technical-essay.md` and `docs/failure-taxonomy.md`. Changes to the policy engine, simulation contract, or receipt format need strong justification — these are the primitives that institutional users depend on.

The policy engine is pure TypeScript with no chain dependencies. Keep it that way. Chain-specific logic belongs in adapters, not in core.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
