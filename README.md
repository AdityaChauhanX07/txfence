# txfence

The fence between what an agent wants to do and what it does on-chain.

txfence is a typed, composable policy-and-execution SDK for autonomous agents operating across EVM and Solana. It provides simulation-before-execution, declarative spending policies, and human-in-the-loop hooks as first-class primitives.

## Why txfence

Autonomous agents transacting on-chain fail in ways that are not obvious. They do not fail because of bugs or hacks. They fail because the conditions at execution time were different from the conditions when their instructions were written. State moved. A contract was upgraded. Two agents read the same cap simultaneously. A human approval timed out and the system defaulted to execute.

These are policy failures, not security failures. txfence is the policy layer.

Read the full analysis: [docs/technical-essay.md](docs/technical-essay.md)
Read the failure taxonomy: [docs/failure-taxonomy.md](docs/failure-taxonomy.md)

## Packages

| Package | Description |
|---|---|
| `@txfence/core` | Policy engine, type definitions, agent orchestration |
| `@txfence/evm` | EVM chain adapter (Ethereum, Arbitrum, Optimism, Base) |
| `@txfence/solana` | Solana chain adapter |

## Quick start

```typescript
import { createAgent } from '@txfence/core'
import type { ChainAdapter } from '@txfence/core'
import { simulateEvmAction } from '@txfence/evm'

const evmAdapter: ChainAdapter = {
  simulate: simulateEvmAction
}

const agent = createAgent(
  {
    chains: ['ethereum'],
    policies: {
      maxSpendPerTx:          { token: 'USDC', amount: 1000n, decimals: 6 },
      allowedContracts:       [{ address: '0xYOUR_CONTRACT', chain: 'ethereum' }],
      requireSimulation:      true,
      gasBufferMultiplier:    1.2,
      humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
      humanApprovalTimeoutMs: 30000,
      capLockMode:            'per-agent',
      chains:                 ['ethereum'],
    },
    signer: { sign: async () => '', address: '' },
  },
  { ethereum: evmAdapter },
  { ethereum: 'https://ethereum.publicnode.com' }
)

const result = await agent.submit({
  action: {
    kind:        'swap',
    chain:       'ethereum',
    from:        { token: 'USDC', amount: 500n, decimals: 6 },
    to:          'ETH',
    via:         '0xYOUR_CONTRACT',
    maxSlippage: 50,
  },
  policy: agent.config.policies,
})

switch (result.status) {
  case 'success':
    console.log('tx hash:', result.receipt.txHash)
    break
  case 'policy_rejected':
    console.log('rejected:', result.evaluation.rejectionReason)
    break
  case 'simulation_failed':
    console.log('simulation failed:', result.simulation.caveats)
    break
  case 'approval_timeout':
    console.log('approval required above threshold')
    break
  case 'execution_failed':
    console.log('failed:', result.reason)
    break
}
```

## What txfence protects against

| Failure mode | Protected |
|---|---|
| Slippage overrun | Yes — enforced at signing |
| Cross-chain intent replay | Yes — chain scoping at policy level |
| Execute-on-timeout | Yes — cancel is the hard default |
| Simulation-execution divergence | Partially — output bounds limit damage |
| Unintended proxy target | Partially — with implementation hash pinning |
| Stale allowlist | Partially — with metadata verification |
| Gas estimation failure | Partially — minimum buffer multiplier enforced |
| Spend cap race condition | With cap locking interface |

## Status

txfence is under active development. Signing and broadcasting are not yet implemented.
The policy engine and simulation layer are complete and tested.

- [x] Type definitions
- [x] Policy engine (39 tests)
- [x] EVM chain adapter
- [x] Solana chain adapter
- [ ] Signing layer
- [ ] Broadcasting layer
- [ ] Cap locking implementation
- [ ] Contract metadata verification

## Running the example

```bash
pnpm install
cd examples
npx tsx evm-swap.ts
```

## License

MIT
