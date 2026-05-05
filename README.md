# txfence

![CI](https://github.com/AdityaChauhanX07/txfence/actions/workflows/ci.yml/badge.svg)

The fence between what an agent wants to do and what it does on-chain.

txfence is a typed, composable policy-and-execution SDK for autonomous agents operating across EVM and Solana. It provides simulation-before-execution, declarative spending policies, and human-in-the-loop hooks as first-class primitives.

## Why txfence

Autonomous agents transacting on-chain fail in ways that are not obvious. They do not fail because of bugs or hacks. They fail because the conditions at execution time were different from the conditions when their instructions were written. State moved. A contract was upgraded. Two agents read the same cap simultaneously. A human approval timed out and the system defaulted to execute.

These are policy failures, not security failures. txfence is the policy layer.

Read the full analysis: [docs/technical-essay.md](docs/technical-essay.md)
Read the failure taxonomy: [docs/failure-taxonomy.md](docs/failure-taxonomy.md)

---

## Packages

| Package | Description |
|---|---|
| `@txfence/core` | Policy engine, type definitions, agent orchestration, cap locking |
| `@txfence/evm` | EVM chain adapter (Ethereum, Arbitrum, Optimism, Base) |
| `@txfence/solana` | Solana chain adapter |
| `@txfence/redis` | Redis-backed cap lock provider for multi-agent environments |
| `@txfence/mcp` | MCP server exposing txfence as tools for AI assistants |
| `@txfence/cli` | Command-line interface for policy checking, simulation, and execution |
| `@txfence/react` | React hooks for building frontends on top of txfence agents |

---

## Quick start

```typescript
import { createAgent } from '@txfence/core'
import type { ChainAdapter } from '@txfence/core'
import { simulateEvmAction, executeEvmAction, privateKeySigner } from '@txfence/evm'

const evmAdapter: ChainAdapter = {
  simulate: simulateEvmAction,
}

const signer = privateKeySigner(process.env.PRIVATE_KEY as `0x${string}`)

const agent = createAgent(
  {
    chains: ['ethereum'],
    policies: {
      chains:                 ['ethereum'],
      maxSpendPerTx:          { token: 'USDC', amount: 1000n, decimals: 6 },
      allowedContracts:       [{ address: '0xYOUR_CONTRACT', chain: 'ethereum' }],
      requireSimulation:      true,
      gasBufferMultiplier:    1.2,
      humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
      humanApprovalTimeoutMs: 30000,
      capLockMode:            'per-agent',
    },
    signer,
  },
  { ethereum: evmAdapter },
  { ethereum: 'https://ethereum.publicnode.com' },
  (action, chainId, rpcUrl, evaluation, simulation) =>
    executeEvmAction(action, chainId, rpcUrl, signer, evaluation, simulation)
)

const result = await agent.submit({
  action: {
    kind:    'transfer',
    chain:   'ethereum',
    token:   { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
    to:      '0xRECIPIENT',
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

---

## CLI

Install and scaffold a config:

```bash
cd your-project
npx txfence init
```

Simulate an action:

```bash
npx txfence simulate \
  --kind transfer \
  --chain ethereum \
  --to 0xRECIPIENT \
  --token ETH \
  --amount 100000000000000000
```

Check a policy:

```bash
npx txfence check-policy \
  --kind transfer \
  --chain ethereum \
  --to 0xRECIPIENT \
  --token ETH \
  --amount 100000000000000000
```

Submit (dry run by default):

```bash
npx txfence submit \
  --kind transfer \
  --chain ethereum \
  --to 0xRECIPIENT \
  --token ETH \
  --amount 100000000000000000
```

Add `--execute` to broadcast for real.

---

## MCP server

Add txfence as a tool for any MCP-compatible AI assistant:

```json
{
  "mcpServers": {
    "txfence": {
      "command": "npx",
      "args": ["tsx", "packages/mcp/src/index.ts", "--config", "./txfence.config.ts"]
    }
  }
}
```

The assistant can then call `txfence_simulate`, `txfence_check_policy`, `txfence_submit`, `txfence_get_receipt`, and `txfence_explain_rejection`. See [packages/mcp/README.md](packages/mcp/README.md) for the full tool reference.

---

## React hooks

```typescript
import { useAgent, useSubmit } from '@txfence/react'
import { simulateEvmAction, executeEvmAction, privateKeySigner } from '@txfence/evm'

const signer = privateKeySigner(import.meta.env.VITE_PRIVATE_KEY)

function TransferButton() {
  const agent = useAgent({
    config: { chains: ['ethereum'], policies, signer },
    adapters: { ethereum: { simulate: simulateEvmAction } },
    rpcUrls: { ethereum: 'https://ethereum.publicnode.com' },
    executor: (action, chainId, rpcUrl, evaluation, simulation) =>
      executeEvmAction(action, chainId, rpcUrl, signer, evaluation, simulation),
  })

  const { result, loading, submit } = useSubmit(agent)

  return (
    <button onClick={() => submit(transferAction, policy)} disabled={loading}>
      {loading ? 'submitting...' : 'send'}
    </button>
  )
}
```

---

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
| Spend cap race condition | Yes — with cap locking interface |

---

## Running the example

```bash
pnpm install
cd examples
npx tsx evm-swap.ts
```

---

## Status

```
packages/core        policy engine, agent orchestration, cap locking — 79 tests
packages/evm         simulate, build, sign, broadcast, metadata verify
packages/solana      simulate, build, sign, broadcast (transfers + pre-built txs)
packages/redis       Redis CapLockProvider with atomic Lua scripts
packages/mcp         MCP server with 5 tools — 5 tests
packages/cli         CLI with 5 commands — 7 tests
packages/react       React hooks — 7 tests
packages/integration Anvil integration tests — 5 tests
```

108 tests. Zero type errors across all packages.

- [x] Type definitions
- [x] Policy engine
- [x] EVM chain adapter
- [x] Solana chain adapter
- [x] EVM signing and broadcasting
- [x] Solana signing and broadcasting (transfers + pre-built transactions)
- [x] Cap locking — absolute cap + rolling window
- [x] Contract metadata verification
- [x] Redis CapLockProvider
- [x] Multi-chain adapter
- [x] MCP server
- [x] CLI
- [x] React hooks
- [x] Anvil integration tests

---

## License

MIT
