# @txfence/core

Policy engine, agent orchestration, simulation pipeline, cap locking, receipt storage, webhook approval, temporal rules, intent execution, and chain-agnostic policy expressions for the [txfence](https://github.com/AdityaChauhanX07/txfence) SDK.

`@txfence/core` is the chain-agnostic heart of txfence. It contains everything except the per-chain adapters (`@txfence/evm`, `@txfence/solana`, `@txfence/cosmos`) and the storage/integration packages (`@txfence/storage-pg`, `@txfence/redis`, `@txfence/audit`, `@txfence/monitor`, `@txfence/verify`, `@txfence/provenance`).

## Installation

```bash
npm install @txfence/core
# or
pnpm add @txfence/core
```

## Quick start

```typescript
import { createAgent, type Policy } from '@txfence/core'
import { simulateEvmAction, executeEvmAction, privateKeySigner } from '@txfence/evm'

const signer = privateKeySigner(process.env.PRIVATE_KEY as `0x${string}`)

const policy: Policy = {
  chains:                 ['ethereum'],
  maxSpendPerTx:          { token: 'USDC', amount: 1000n, decimals: 6 },
  allowedContracts:       [{ address: '0xYOUR_CONTRACT', chain: 'ethereum' }],
  requireSimulation:      true,
  gasBufferMultiplier:    1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
  humanApprovalTimeoutMs: 30000,
  capLockMode:            'per-agent',
}

const agent = createAgent(
  { chains: ['ethereum'], policies: policy, signer },
  { ethereum: { simulate: simulateEvmAction } },
  { ethereum: 'https://ethereum.publicnode.com' },
  (action, chainId, rpcUrl, evaluation, simulation) =>
    executeEvmAction(action, chainId, rpcUrl, signer, evaluation, simulation),
)

const result = await agent.submit({
  action: {
    kind:  'transfer',
    chain: 'ethereum',
    token: { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
    to:    '0xRECIPIENT',
  },
  policy,
})

switch (result.status) {
  case 'success':           console.log('tx', result.receipt.txHash); break
  case 'policy_rejected':   console.log('rejected:', result.evaluation.rejectionReason); break
  case 'simulation_failed': console.log('simulation failed'); break
  case 'approval_timeout':  console.log('approval timed out'); break
  case 'execution_failed':  console.log('execution failed:', result.reason); break
}
```

## Policy engine

A `Policy` declares everything an agent is allowed to do: which chains, which contracts, how much per transaction, what triggers human approval, how long approvals can wait, what to do when concurrent requests race for the same cap.

```typescript
import { evaluate } from '@txfence/core'

const evaluation = evaluate(action, policy)
// evaluation.passed: boolean
// evaluation.checksRun: array of check names
// evaluation.rejectionReason: PolicyRejectionReason | undefined
```

## Composite policies

Compose AND/OR trees:

```typescript
import { policyAnd, policyOr, policyLeaf, evaluateNode } from '@txfence/core'

const tree = policyAnd([
  policyOr([
    policyLeaf(smallSpend,   'small-spend'),    // up to 1000 USDC, no approval
    policyLeaf(largeSpend,   'large-spend'),    // up to 50000 USDC, needs approval
  ], 'spend-tier'),
  policyLeaf(contractAllowlist, 'allowlist'),
], 'treasury')

const node = evaluateNode(action, tree)
```

## Temporal rules

Enforce limits over time, not just per-transaction:

```typescript
import { createMemoryEventStore } from '@txfence/core'

const policy: Policy = {
  // ...static fields...
  temporalRules: [
    {
      predicate:   { kind: 'simulation_failure_rate', windowMs: 3_600_000, threshold: 3 },
      consequence: { kind: 'require_approval' },
      label:       'sim-failure-guard',
    },
    {
      predicate:   { kind: 'spend_velocity', windowMs: 1_800_000, maxAmount: 50_000n, token: 'USDC' },
      consequence: { kind: 'reject' },
      label:       'velocity-limit',
    },
  ],
}

const eventStore = createMemoryEventStore()
const agent = createAgent(config, adapters, rpcUrls, executor, undefined, undefined, eventStore, undefined, 'agent-id')
```

Six predicate kinds: `simulation_failure_rate`, `contract_call_frequency`, `success_drought`, `spend_velocity`, `consecutive_failures`, `approval_flood`.

## Intent execution

Run multi-step operations as a dependency graph:

```typescript
const result = await agent.executeIntent({
  id: 'rebalance-001',
  steps: [
    { id: 'swap',  action: swapAction },
    { id: 'stake', dependsOn: ['swap'], action: stakeAction },
  ],
  intentPolicy: {
    maxTotalGrossSpend: { token: 'USDC', amount: 6_000_000n, decimals: 6 },
    requireAllSteps: true,
  },
})

// result.status: 'completed' | 'partial' | 'failed' | 'rejected' | 'timed_out'
// result.receipts: Record<stepId, SuccessReceipt>
```

Each step's audit entry carries `intentId` and `intentStepId` for compliance tracing.

## Chain-agnostic policy expressions

Write policies in terms of protocols and assets, not raw addresses:

```typescript
import { protocol, maxSpend } from '@txfence/core'

const policy: Policy = {
  chains: ['ethereum', 'arbitrum'],
  maxSpendPerTx: maxSpend(10_000n, 'USDC', 'ethereum'),
  allowedContracts: [
    ...protocol('uniswap-v3', ['ethereum', 'arbitrum']),
    ...protocol('aave-v3',    ['ethereum']),
  ],
}
```

Built-in registry: 21 assets, 16 protocol entries across Ethereum, Arbitrum, Optimism, Base, Cosmos Hub, Osmosis. Extend with `createRegistry()`.

## Cap locking

Two-phase acquire/commit/release prevents race conditions when multiple agents spend against shared caps:

```typescript
import { createMemoryCapLockProvider } from '@txfence/core'

const capLockProvider = createMemoryCapLockProvider([
  {
    capId: 'treasury-main',
    absoluteCap:   { maxAmount: 500_000n, token: 'USDC' },
    rollingWindow: { windowMs: 3_600_000, maxAmount: 25_000n, token: 'USDC' },
  },
])
```

For distributed environments use `@txfence/redis`.

## Dry-run mode

Run the full pipeline without signing or broadcasting:

```typescript
import { runDryRun } from '@txfence/core'

const report = await runDryRun(action, policy, adapters, rpcUrls)
// report.blockers: DryRunBlocker[] — exactly what would stop execution
```

## Notification system

```typescript
import {
  createConsoleNotificationProvider,
  createWebhookNotificationProvider,
  createCompositeNotificationProvider,
} from '@txfence/core'

const notifier = createCompositeNotificationProvider([
  createConsoleNotificationProvider(),
  createWebhookNotificationProvider('https://your-system.com/hooks', { secret: process.env.HOOK_SECRET }),
])
```

Fires on rejections, approval requests, executions, simulation failures, cap saturation, and temporal-rule triggers.

## Webhook approval

```typescript
import { createWebhookApprovalProvider } from '@txfence/core'

const approval = createWebhookApprovalProvider(
  'https://your-system.com/webhooks/txfence',
  'https://your-system.com/approvals',
  { webhookSecret: process.env.WEBHOOK_SECRET },
)
```

HMAC-SHA256 signed payloads. Cancel-on-timeout is the hard default — execute-on-timeout is never offered.

## Receipt storage

```typescript
import { createMemoryReceiptStore, createFileReceiptStore } from '@txfence/core'

const store = createFileReceiptStore('./receipts.jsonl')
const eth   = await store.list({ chain: 'ethereum' })
```

Production backends live in `@txfence/storage-pg` and `@txfence/storage-sqlite`. All backends share the same `ReceiptStore` contract.

## Related packages

- `@txfence/evm`, `@txfence/solana`, `@txfence/cosmos` — chain adapters
- `@txfence/redis`, `@txfence/storage-pg`, `@txfence/storage-sqlite` — distributed cap locking and receipt storage
- `@txfence/audit` — append-only audit log capturing every pipeline decision
- `@txfence/monitor` — on-chain reconciliation monitor
- `@txfence/verify` — formal policy verification with counterexample generation
- `@txfence/provenance` — cryptographic provenance chains with Merkle proofs
- `@txfence/mcp`, `@txfence/cli`, `@txfence/react` — agent-facing interfaces

Full project README: https://github.com/AdityaChauhanX07/txfence

## License

MIT
