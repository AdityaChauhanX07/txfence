# txfence

![CI](https://github.com/AdityaChauhanX07/txfence/actions/workflows/ci.yml/badge.svg)

The fence between what an agent wants to do and what it does on-chain.

txfence is a typed, composable policy-and-execution SDK for autonomous agents operating across EVM, Solana, and Cosmos. It provides simulation-before-execution, declarative spending policies, and human-in-the-loop hooks as first-class primitives.

## Why txfence

Autonomous agents transacting on-chain fail in ways that are not obvious. They do not fail because of bugs or hacks. They fail because the conditions at execution time were different from the conditions when their instructions were written. State moved. A contract was upgraded. Two agents read the same cap simultaneously. A human approval timed out and the system defaulted to execute.

These are policy failures, not security failures. txfence is the policy layer.

Read the full analysis: [docs/technical-essay.md](docs/technical-essay.md)
Read the failure taxonomy: [docs/failure-taxonomy.md](docs/failure-taxonomy.md)

---

## Packages

| Package | Description |
|---|---|
| `@txfence/core` | Policy engine, agent orchestration, cap locking, receipt storage, webhook approval |
| `@txfence/evm` | EVM chain adapter (Ethereum, Arbitrum, Optimism, Base) with Tenderly support |
| `@txfence/solana` | Solana chain adapter |
| `@txfence/cosmos` | Cosmos chain adapter (Cosmos Hub, Osmosis) |
| `@txfence/redis` | Redis-backed cap lock provider for multi-agent environments |
| `@txfence/storage-pg` | PostgreSQL receipt storage backend |
| `@txfence/mcp` | MCP server exposing txfence as tools for AI assistants |
| `@txfence/cli` | Command-line interface for policy checking, simulation, and execution |
| `@txfence/react` | React hooks for building frontends on top of txfence agents |
| `@txfence/audit` | Append-only audit log for compliance — captures every policy decision, rejection, and execution outcome |
| `@txfence/monitor` | On-chain reconciliation monitor — detects unrecorded transactions and chain reorganizations |

---

## Quick start

```typescript
import { createAgent } from '@txfence/core'
import type { ChainAdapter } from '@txfence/core'
import { simulateEvmAction, executeEvmAction, privateKeySigner } from '@txfence/evm'

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
  { ethereum: { simulate: simulateEvmAction } },
  { ethereum: 'https://ethereum.publicnode.com' },
  (action, chainId, rpcUrl, evaluation, simulation) =>
    executeEvmAction(action, chainId, rpcUrl, signer, evaluation, simulation)
)

const result = await agent.submit({
  action: {
    kind:  'transfer',
    chain: 'ethereum',
    token: { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
    to:    '0xRECIPIENT',
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

## Tenderly simulation

For deeper EVM simulation coverage with full execution traces and accurate revert reasons:

```typescript
import { simulateEvmAction, simulateWithTenderly } from '@txfence/evm'
import type { TenderlyConfig } from '@txfence/evm'

const tenderlyConfig: TenderlyConfig = {
  accessKey:    process.env.TENDERLY_ACCESS_KEY!,
  accountSlug:  'your-account',
  projectSlug:  'your-project',
}

// simulateWithTenderly returns coverageLevel: 'deep' with full call trace,
// state diff, and decoded logs. Falls back to eth_call if not configured.
```

---

## Webhook approval

For transactions above `humanApprovalThreshold`, the pipeline dispatches a webhook and waits for a human decision before executing:

```typescript
import { createWebhookApprovalProvider } from '@txfence/core'

const approvalProvider = createWebhookApprovalProvider(
  'https://your-system.com/webhooks/txfence',
  'https://your-system.com/approvals',
  { webhookSecret: process.env.WEBHOOK_SECRET }
)

const agent = createAgent(
  config, adapters, rpcUrls, executor,
  undefined, undefined, approvalProvider
)
```

The webhook payload includes `approveUrl` and `rejectUrl` for one-click email approval. Payloads are signed with HMAC-SHA256 via the `X-TXFence-Signature` header. Cancel-on-timeout is the hard default.

---

## Cap locking

For multi-agent environments where multiple agents share a spend cap:

```typescript
import { createMemoryCapLockProvider } from '@txfence/core'
// or for distributed environments:
import { createRedisCapLockProvider } from '@txfence/redis'

const capLockProvider = createMemoryCapLockProvider([
  {
    capId: 'treasury-main',
    absoluteCap:   { maxAmount: 500_000n, token: 'USDC' },
    rollingWindow: { windowMs: 3_600_000, maxAmount: 25_000n, token: 'USDC' },
  }
])
```

Two independent risk controls: absolute cap (hard budget) and rolling window (velocity circuit breaker). Two-phase acquire/commit/release prevents race conditions across concurrent agents.

---

## Receipt storage

```typescript
import { createFileReceiptStore } from '@txfence/core'
// or for production:
import { createPgReceiptStore, initSchema } from '@txfence/storage-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
await initSchema(pool)

const receiptStore = createPgReceiptStore(pool)

// receipts are automatically saved after every successful execution
const receipts = await receiptStore.list({ chain: 'ethereum', from: 25000000 })
```

---

## Audit log

```typescript
import { createFileAuditLog } from '@txfence/audit'

const auditLog = createFileAuditLog('./audit.jsonl')

const agent = createAgent(
  config, adapters, rpcUrls, executor,
  undefined, undefined, undefined, undefined,
  receiptStore, auditLog
)

// every decision is recorded — rejections, simulations, approvals, executions
const rejected = await auditLog.query({ status: 'policy_rejected' })
const swaps = await auditLog.query({ actionKind: 'swap', from: Date.now() - 86400000 })
```

The audit log captures every pipeline decision regardless of outcome.
Unlike receipt storage which only records successful transactions,
the audit log records policy rejections, simulation failures, approval
decisions, and execution outcomes. Designed for compliance teams that
need a complete trail of agent activity.

Known limitation: no tamper evidence in v1. Use a write-once storage
backend (e.g. S3 with object lock) for strict tamper-evidence requirements.

---

## Monitor

```typescript
import { createMonitor, createFileCheckpointStore } from '@txfence/monitor'
import { createFileReceiptStore } from '@txfence/core'

const monitor = createMonitor({
  chains: ['ethereum'],
  agentAddresses: {
    ethereum: ['0xYOUR_AGENT_ADDRESS'],
  },
  rpcUrls: {
    ethereum: process.env.ETHEREUM_RPC_URL!,
  },
  receiptStore: createFileReceiptStore('./receipts.jsonl'),
  checkpointStore: createFileCheckpointStore('./monitor-checkpoint.json'),
  pollIntervalMs: 12000,
  maxBlocksPerPoll: 5,
  gracePeriodMs: 30000,
  reconcileIntervalMs: 300000,
  onUnrecordedTransaction: (event) => {
    if (event.severity === 'critical') {
      // page someone — signing key may be compromised
      console.error('CRITICAL: unrecorded transaction', event)
    } else {
      console.warn('WARNING: unrecorded transaction (within grace period)', event)
    }
  },
  onCriticalTransaction: (event) => {
    // separate escalation path for critical events
  },
  onReorgDetected: (event) => {
    console.warn('chain reorganization detected', event)
  },
})

await monitor.start()
```

The monitor watches known agent addresses by scanning blocks. If a transaction
appears on-chain from an agent address that txfence did not record, it fires
`onUnrecordedTransaction`. After the grace period passes without the transaction
appearing in the receipt store, severity escalates to `critical`.

Important: block scanning is RPC-intensive. Use a dedicated RPC endpoint
(Alchemy, Infura) rather than a public node in production. Public nodes will
rate-limit you under continuous polling.

---

## CLI

Scaffold a config:

```bash
npx txfence init
```

Simulate, check policy, submit:

```bash
npx txfence simulate --kind transfer --chain ethereum --to 0xRECIPIENT --token ETH --amount 100000000000000000
npx txfence check-policy --kind transfer --chain ethereum --to 0xRECIPIENT --token ETH --amount 100000000000000000
npx txfence submit --kind transfer --chain ethereum --to 0xRECIPIENT --token ETH --amount 100000000000000000
npx txfence submit --execute  # add --execute for real transactions
```

Compare two policy configurations:

```bash
npx txfence diff \
  --config-a ./txfence.config.ts \
  --config-b ./txfence.config.proposed.ts \
  --generate-actions
```

Exits 1 if any actions are newly rejected — CI-friendly for policy change review.
Use `--actions-file actions.json` to test against a specific set of actions instead.

---

## MCP server

Add txfence as a tool for any MCP-compatible AI assistant:

```json
{
  "mcpServers": {
    "txfence": {
      "command": "npx",
      "args": ["tsx", "packages/mcp/src/bin.ts", "--config", "./txfence.config.ts"]
    }
  }
}
```

Six tools: `txfence_simulate`, `txfence_check_policy`, `txfence_submit`, `txfence_get_receipt`, `txfence_explain_rejection`, `txfence_diff_policies`. See [packages/mcp/README.md](packages/mcp/README.md) for the full reference.

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
    <button onClick={() => submit(action, policy)} disabled={loading}>
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
| Unauthorized approval execution | Yes — HMAC-signed webhooks, cancel on timeout |

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
packages/core         policy engine, agent orchestration, cap locking,
                      receipt storage, webhook approval — 147 tests
packages/evm          simulate (eth_call + Tenderly), build, sign,
                      broadcast, metadata verify — 7 tests
packages/solana       simulate, build, sign, broadcast — 5 tests
packages/cosmos       simulate, build, sign, broadcast
                      (cosmoshub + osmosis) — 10 tests
packages/redis        Redis CapLockProvider with atomic Lua scripts
packages/storage-pg   PostgreSQL receipt storage — 12 tests
packages/mcp          MCP server with 5 tools — 5 tests
packages/cli          CLI with 6 commands — 7 tests
packages/react        React hooks — 7 tests
packages/audit       append-only audit log — memory + file backends — 20 tests
packages/monitor     on-chain reconciliation monitor — 13 tests
packages/integration  Anvil integration tests — 7 passing + 5 skipped
```

252 tests passing. CI green. Zero type errors across all packages.

- [x] Type definitions
- [x] Policy engine
- [x] EVM chain adapter with Tenderly simulation
- [x] Solana chain adapter
- [x] Cosmos chain adapter (Cosmos Hub, Osmosis)
- [x] EVM signing and broadcasting
- [x] Solana signing and broadcasting
- [x] Cap locking — absolute cap + rolling window
- [x] Redis CapLockProvider
- [x] Contract metadata verification
- [x] Pluggable receipt storage — memory, file, PostgreSQL
- [x] Webhook-based human approval with HMAC signing
- [x] Multi-chain adapter
- [x] MCP server
- [x] CLI
- [x] React hooks
- [x] Anvil integration tests
- [x] GitHub Actions CI
- [x] tsup build pipeline
- [x] Append-only audit log with policy snapshot immutability
- [x] On-chain reconciliation monitor with checkpoint persistence
- [x] Policy diff tool with CLI and MCP integration

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT