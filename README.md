# txfence

[![npm](https://img.shields.io/npm/v/@txfence/core.svg)](https://www.npmjs.com/package/@txfence/core) ![CI](https://github.com/AdityaChauhanX07/txfence/actions/workflows/ci.yml/badge.svg)

The fence between what an agent wants to do and what it does on-chain.

txfence is a typed, composable policy-and-execution SDK for autonomous agents operating across EVM, Solana, and Cosmos. It provides simulation-before-execution, declarative spending policies, human-in-the-loop hooks, formal policy verification, and cryptographic audit trails as first-class primitives.

## Why txfence

Autonomous agents transacting on-chain fail in ways that are not obvious. They do not fail because of bugs or hacks. They fail because the conditions at execution time were different from the conditions when their instructions were written. State moved. A contract was upgraded. Two agents read the same cap simultaneously. A human approval timed out and the system defaulted to execute.

These are policy failures, not security failures. txfence is the policy layer.

Read the full analysis: [docs/technical-essay.md](docs/technical-essay.md)
Read the failure taxonomy: [docs/failure-taxonomy.md](docs/failure-taxonomy.md)

---

## Packages

| Package | Description |
|---|---|
| `@txfence/core` | Policy engine, agent orchestration, cap locking, receipt storage, webhook approval, temporal rules |
| `@txfence/evm` | EVM chain adapter (Ethereum, Arbitrum, Optimism, Base) with Tenderly simulation and fork simulation |
| `@txfence/solana` | Solana chain adapter |
| `@txfence/cosmos` | Cosmos chain adapter (Cosmos Hub, Osmosis) |
| `@txfence/redis` | Redis-backed cap lock provider for multi-agent environments |
| `@txfence/storage-pg` | PostgreSQL receipt storage backend |
| `@txfence/storage-sqlite` | SQLite receipt storage backend — ideal for local development |
| `@txfence/mcp` | MCP server exposing txfence as tools for AI assistants |
| `@txfence/cli` | Command-line interface for policy checking, simulation, verification, and execution |
| `@txfence/react` | React hooks for building frontends on top of txfence agents |
| `@txfence/audit` | Append-only audit log — captures every policy decision, rejection, and execution outcome |
| `@txfence/monitor` | On-chain reconciliation monitor — detects unrecorded transactions and chain reorganizations |
| `@txfence/verify` | Formal policy verification — bounded model checking with counterexample generation and adversarial stress testing |
| `@txfence/provenance` | Cryptographic provenance chains — hash-chained records with Merkle proofs for tamper-evident audit trails |

---

## Quick start

```typescript
import { createAgent } from '@txfence/core'
import type { Policy } from '@txfence/core'
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
    executeEvmAction(action, chainId, rpcUrl, signer, evaluation, simulation)
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
  case 'success':         console.log('tx hash:', result.receipt.txHash); break
  case 'policy_rejected': console.log('rejected:', result.evaluation.rejectionReason); break
  case 'simulation_failed': console.log('simulation failed'); break
  case 'approval_timeout': console.log('approval required above threshold'); break
  case 'execution_failed': console.log('failed:', result.reason); break
}
```

---

## Chain-agnostic policy expressions

Write policies in terms of protocols and assets, not hardcoded addresses:

```typescript
import { protocol, maxSpend } from '@txfence/core'

const policy: Policy = {
  chains: ['ethereum', 'arbitrum'],
  maxSpendPerTx: maxSpend(10_000n, 'USDC', 'ethereum'),  // resolves decimals automatically
  allowedContracts: [
    ...protocol('uniswap-v3', ['ethereum', 'arbitrum']),  // resolves all router + factory addresses
    ...protocol('aave-v3', ['ethereum']),
  ],
  // ...
}
```

Built-in registry includes 21 assets and 16 protocol entries across Ethereum, Arbitrum, Optimism, Base, Cosmos Hub, and Osmosis. Extend with `createRegistry()` for custom protocols.

---

## Composite policies

Express complex authorization logic with AND/OR trees:

```typescript
import { policyAnd, policyOr, policyLeaf } from '@txfence/core'

const treasuryPolicy = policyAnd([
  policyOr([
    policyLeaf(smallSpendPolicy, 'small-spend'),   // up to 1000 USDC, no approval
    policyLeaf(largeSpendPolicy, 'large-spend'),   // up to 50000 USDC, needs approval
  ], 'spend-tier'),
  policyLeaf(contractAllowlistPolicy, 'allowlist'), // always required
], 'treasury')
```

---

## Temporal rules

Enforce behavioral limits over time — not just per-transaction:

```typescript
const policy: Policy = {
  // ...static fields...
  temporalRules: [
    {
      // 3 simulation failures in 1 hour → require human approval
      predicate: { kind: 'simulation_failure_rate', windowMs: 3_600_000, threshold: 3 },
      consequence: { kind: 'require_approval' },
      label: 'sim-failure-guard',
    },
    {
      // spend velocity: max 50K USDC in any 30-minute window
      predicate: { kind: 'spend_velocity', windowMs: 1_800_000, maxAmount: 50_000n, token: 'USDC' },
      consequence: { kind: 'reject' },
      label: 'velocity-limit',
    },
    {
      // same contract called 5 times in 10 minutes → flag for review
      predicate: { kind: 'contract_call_frequency', contractAddress: '0xROUTER', windowMs: 600_000, threshold: 5 },
      consequence: { kind: 'flag_for_review' },
    },
  ],
}

// Pass an event store to createAgent — records every pipeline outcome
import { createMemoryEventStore } from '@txfence/core'
const store = createMemoryEventStore()
const agent = createAgent(config, adapters, rpcUrls, executor, ..., store, 'agent-0x123')
```

Six predicate kinds: `simulation_failure_rate`, `contract_call_frequency`, `success_drought`, `spend_velocity`, `consecutive_failures`, `approval_flood`.

---

## Intent-level execution

Execute multi-step operations as a dependency graph:

```typescript
import { executeIntent } from '@txfence/core'

const result = await agent.executeIntent({
  id: 'treasury-rebalance-001',
  label: 'Rebalance: USDC → ETH position',
  steps: [
    {
      id: 'swap',
      action: { kind: 'swap', chain: 'ethereum', from: { token: 'USDC', amount: 5_000_000n, decimals: 6 }, to: 'ETH', via: '0xROUTER', maxSlippage: 50 },
    },
    {
      id: 'stake',
      dependsOn: ['swap'],   // only runs if swap succeeds
      action: { kind: 'contract_call', chain: 'ethereum', contract: '0xLIDO', method: 'submit', args: [] },
    },
  ],
  intentPolicy: {
    maxTotalGrossSpend: { token: 'USDC', amount: 6_000_000n, decimals: 6 },
    requireAllSteps: true,
  },
})

// result.status: 'completed' | 'partial' | 'failed' | 'rejected' | 'timed_out'
// result.receipts: Record<stepId, SuccessReceipt>
// result.positionAnalysis: gross outflow, net change, intermediate exposure
```

Every step's audit entry includes `intentId` and `intentStepId` for compliance tracing.

---

## Fork simulation

Simulate a multi-step intent against a forked chain state before committing:

```typescript
import { simulateIntentOnFork } from '@txfence/evm'

const result = await simulateIntentOnFork(
  rebalanceIntent,
  {
    provider: 'tenderly',
    tenderlyConfig: { accessKey, accountSlug, projectSlug },
    fromAddress: agentAddress,
  },
  'ethereum',
  rpcUrl,
)

console.log('Would all succeed:', result.wouldAllSucceed)
console.log('Final position:', result.finalPosition)
console.log('Failing step:', result.failingStepId)
// Fork is automatically deleted after simulation — no leaked resources
```

Or from the CLI:
```bash
txfence intent fork-simulate --intent ./rebalance.json --from 0xAGENT --chain ethereum
```

---

## MEV protection

Route transactions through private channels to prevent sandwich attacks:

```typescript
const policy: Policy = {
  // ...
  mevProtection: 'flashbots',  // or 'mev-blocker' or 'none'
}
```

Flashbots Protect (`https://rpc.flashbots.net`) and MEV Blocker (`https://rpc.mevblocker.io`) are supported. Configurable per-transaction — swaps can use Flashbots while transfers use none.

---

## Formal policy verification

Prove invariants about your policy configuration before deploying:

```typescript
import { verify, stressTest } from '@txfence/verify'

// Bounded model checking — proves property holds or generates counterexample
const result = verify({
  kind: 'rolling_window_saturation',
  agentCount: 10,
  transactionsPerAgent: 20,
  windowMs: 3_600_000,
  capAmount: 50_000n,
  token: 'USDC',
  maxSpendPerTx: 1_000n,
})

if (result.status === 'violated') {
  console.log(result.counterExample.description)
  // "10 agents × 20 transactions at 1000 USDC each can collectively reach 200000 USDC..."
}

// Adversarial stress testing — 6 attack vectors, risk report
const report = await stressTest(policy, {
  agentCount: 10,
  transactionsPerScenario: 20,
  vectors: ['rapid_fire', 'coordinated_drain', 'cap_boundary'],
})

console.log(`Survival rate: ${(report.survivalRate * 100).toFixed(1)}%`)
console.log(report.recommendation)
```

From the CLI:
```bash
txfence verify rolling-window --config ./txfence.config.ts --agents 10 --transactions 20 --cap 50000 --window 3600000 --token USDC
txfence verify absolute-cap --config ./txfence.config.ts --agents 10 --transactions 10 --cap 50000 --token USDC
txfence verify policy-contains --inner ./strict.config.ts --outer ./permissive.config.ts
txfence stress-test --config ./txfence.config.ts --agents 10 --transactions 20
```

Three verification properties: `rolling_window_saturation`, `absolute_cap_reachability`, `policy_containment`. Six stress test attack vectors: `rapid_fire`, `coordinated_drain`, `rpc_failure`, `stale_simulation`, `cap_boundary`, `approval_flood`.

---

## Provenance chains

Cryptographically linked records proving every transaction followed your policy:

```typescript
import { createFileProvenanceChain } from '@txfence/provenance'

const chain = createFileProvenanceChain('./provenance.jsonl')

// Append a record after each pipeline execution
await chain.append({
  agentId: '0xAGENT',
  policyVersionId: getPolicyVersionId(policy),
  action,
  simulationResult,
  approvalDecision: 'not_required',
  outcome: { status: 'success', txHash: '0x...', confirmedAtBlock: 1000, gasUsed: '21000' },
  timestamp: Date.now(),
})

// Verify the chain has not been tampered with
const result = await chain.verify()
console.log(result.valid)   // true if unmodified
console.log(result.merkleRoot)

// Generate a compact Merkle proof for a specific transaction
const proof = await chain.generateProof(entryHash)
console.log(chain.verifyProof(proof))  // true
```

From the CLI:
```bash
txfence provenance verify --chain ./provenance.jsonl
txfence provenance proof --chain ./provenance.jsonl --hash <entryHash>
```

Hash chaining detects any modification — changing one record invalidates all subsequent records. Merkle proofs are O(log n) — prove a record exists without revealing others.

---

## Replay and backtesting

Test a proposed policy against historical audit log data:

```bash
txfence replay --audit-log ./audit.jsonl --config ./proposed.config.ts --only-changed
```

Answers: "If this policy had been active last month, which transactions would have been rejected that weren't, and vice versa?" Exits 1 if any transactions are newly rejected — CI-friendly policy regression gate.

---

## Policy versioning

Every policy gets a stable SHA-256 fingerprint:

```typescript
import { getPolicyVersionId, createPolicyVersion } from '@txfence/core'

const versionId = getPolicyVersionId(policy)  // stable regardless of key order
const version = createPolicyVersion(policy, { label: 'treasury-v3', author: 'alice' })
```

```bash
txfence policy-snapshot --config ./txfence.config.ts --label treasury-v3 --author alice
```

The audit log references `policyVersionId` on every entry — compliance teams can answer "what policy was active when this transaction was approved?"

---

## Multi-agent coordination

Intent claiming, priority, and rate limiting across agents:

```typescript
import { createMemoryAgentCoordinator, getIntentId } from '@txfence/core'

const coordinator = createMemoryAgentCoordinator()
coordinator.registerAgent({ agentId: 'treasury', priority: 10 })
coordinator.registerAgent({ agentId: 'rebalancer', priority: 5 })

// Claim an intent before executing — prevents duplicate execution
const claim = await coordinator.claimIntent(getIntentId(action), 'treasury')
if (!claim.claimed) {
  console.log('Intent already claimed by', claim.claimedBy)
}

// Rate limiting
await coordinator.recordTransaction('treasury')
const limited = await coordinator.isRateLimited('treasury')
```

---

## Webhook approval

```typescript
import { createWebhookApprovalProvider } from '@txfence/core'

const approvalProvider = createWebhookApprovalProvider(
  'https://your-system.com/webhooks/txfence',
  'https://your-system.com/approvals',
  { webhookSecret: process.env.WEBHOOK_SECRET }
)
```

Payloads include `approveUrl` and `rejectUrl` for one-click approval. HMAC-SHA256 signed. Cancel-on-timeout is the hard default.

---

## Cap locking

```typescript
import { createMemoryCapLockProvider } from '@txfence/core'
import { createRedisCapLockProvider } from '@txfence/redis'

const capLockProvider = createMemoryCapLockProvider([
  {
    capId: 'treasury-main',
    absoluteCap:   { maxAmount: 500_000n, token: 'USDC' },
    rollingWindow: { windowMs: 3_600_000, maxAmount: 25_000n, token: 'USDC' },
  }
])
```

Two-phase acquire/commit/release prevents race conditions. Redis implementation uses atomic Lua scripts for distributed multi-agent environments.

---

## Audit log

```typescript
import { createFileAuditLog } from '@txfence/audit'

const auditLog = createFileAuditLog('./audit.jsonl')
const rejected = await auditLog.query({ status: 'policy_rejected' })
```

Captures every pipeline decision — rejections, simulation failures, approvals, executions. Each entry includes `intentId` and `intentStepId` when part of an intent execution.

---

## Monitor

```typescript
import { createMonitor } from '@txfence/monitor'

const monitor = createMonitor({
  chains: ['ethereum'],
  agentAddresses: { ethereum: ['0xYOUR_AGENT_ADDRESS'] },
  rpcUrls: { ethereum: process.env.ETHEREUM_RPC_URL! },
  receiptStore,
  checkpointStore,
  pollIntervalMs: 12000,
  onUnrecordedTransaction: (event) => {
    if (event.severity === 'critical') console.error('CRITICAL:', event)
  },
  onReorgDetected: (event) => console.warn('reorg detected', event),
})

await monitor.start()
```

---

## CLI reference

```bash
# Setup and receipts
txfence init                                       # scaffold a txfence.config.ts in the cwd
txfence receipt --store ./receipts.jsonl [--filter chain=ethereum]

# Policy and simulation
txfence simulate         --kind transfer --chain ethereum --to 0x... --token ETH --amount 1e18
txfence check-policy     --kind transfer --chain ethereum --to 0x... --token ETH --amount 1e18
txfence submit           --kind transfer --chain ethereum --to 0x... --token ETH --amount 1e18
txfence dry-run          --config ./txfence.config.ts --kind transfer --chain ethereum ...
txfence diff             --config-a ./current.ts --config-b ./proposed.ts --generate-actions

# Policy versioning and replay
txfence policy-snapshot  --config ./txfence.config.ts --label v3 --author alice
txfence replay           --audit-log ./audit.jsonl --config ./proposed.ts --only-changed

# Intent execution
txfence intent validate  --config ./txfence.config.ts --intent ./intent.json
txfence intent submit    --config ./txfence.config.ts --intent ./intent.json [--dry-run]
txfence intent fork-simulate --config ./txfence.config.ts --intent ./intent.json --from 0x... --chain ethereum

# Formal verification
txfence verify rolling-window  --config ./txfence.config.ts --agents 10 --transactions 20 --cap 50000 --window 3600000 --token USDC
txfence verify absolute-cap    --config ./txfence.config.ts --agents 10 --transactions 10 --cap 50000 --token USDC
txfence verify policy-contains --inner ./strict.ts --outer ./permissive.ts
txfence stress-test            --config ./txfence.config.ts --agents 10 --transactions 20 [--vectors rapid_fire,cap_boundary]

# Provenance
txfence provenance verify --chain ./provenance.jsonl
txfence provenance proof  --chain ./provenance.jsonl --hash <entryHash>
```

---

## MCP server

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

Tools: `txfence_simulate`, `txfence_check_policy`, `txfence_submit`, `txfence_get_receipt`, `txfence_explain_rejection`, `txfence_diff_policies`, `txfence_validate_config`, `txfence_validate_intent`, `txfence_execute_intent`, `txfence_fork_simulate_intent`, `txfence_replay_audit_log`.

---

## What txfence protects against

| Failure mode | Protected |
|---|---|
| Slippage overrun | Yes — enforced at signing |
| Cross-chain intent replay | Yes — chain scoping at policy level |
| Execute-on-timeout | Yes — cancel is the hard default |
| Simulation-execution divergence | Partially — staleness check + output bounds |
| Unintended proxy target | Partially — with implementation hash pinning |
| Stale allowlist | Partially — with metadata verification |
| Gas estimation failure | Partially — minimum buffer multiplier enforced |
| Spend cap race condition | Yes — two-phase cap locking |
| Unauthorized approval execution | Yes — HMAC-signed webhooks, cancel on timeout |
| MEV sandwich attack | Yes — Flashbots / MEV Blocker routing |
| Policy configuration bug | Yes — formal verification + adversarial stress testing |
| Audit trail tampering | Yes — hash-chained provenance with Merkle proofs |
| Behavioral pattern attacks | Yes — temporal rules with sliding window detection |
| Multi-step intent partial failure | Yes — DAG execution with dependency management |

---

## Running the example

```bash
pnpm install
cd examples/treasury-agent
npx tsx run.ts                    # dry-run pipeline demo
npx tsx simulate-policy-change.ts # policy diff example
npx tsx monitor.ts                # live block scanner (requires RPC)
```

The example intent:
```bash
txfence intent validate --config ./txfence.config.ts --intent ./example-intent.json
```

---

## Status
packages/core          policy engine, agent, cap locking, temporal rules,
intent execution, registry, replay, coordination — 406 tests
packages/evm           simulate (eth_call + Tenderly), fork simulation,
MEV protection, sign, broadcast — 38 tests
packages/solana        simulate, build, sign, broadcast — 5 tests
packages/cosmos        simulate, build, sign, broadcast
(cosmoshub + osmosis) — 29 tests
packages/redis         Redis CapLockProvider with atomic Lua scripts
packages/storage-pg    PostgreSQL receipt storage — 12 tests
packages/storage-sqlite SQLite receipt storage — 12 tests
packages/mcp           MCP server with 11 tools — 5 tests
packages/cli           CLI with 13 commands — 8 tests
packages/react         React hooks — 14 tests
packages/audit         append-only audit log — 20 tests
packages/monitor       on-chain reconciliation monitor — 13 tests
packages/verify        formal verification + adversarial stress testing — 18 tests
packages/provenance    cryptographic provenance chains — 49 tests
packages/integration   Anvil integration tests — 7 passing + 5 skipped

600+ tests passing. CI green. Zero type errors across all packages.

- [x] Policy engine with AND/OR composite trees
- [x] Chain-agnostic policy expressions (asset + protocol registry)
- [x] Temporal rules with sliding window event store
- [x] Intent-level DAG execution with position analysis
- [x] Simulation forking via Tenderly fork API
- [x] MEV protection (Flashbots + MEV Blocker)
- [x] Formal policy verification — bounded model checking + counterexample generation
- [x] Adversarial stress testing — 6 attack vectors, risk reports
- [x] Cryptographic provenance chains — hash chaining + Merkle proofs
- [x] Replay and backtesting against audit logs
- [x] Policy versioning with SHA-256 stable identifiers
- [x] Multi-agent coordination — intent claiming, priority, rate limiting
- [x] Circuit breaker for RPC fault tolerance — three-state breaker with composable adapter wrapping
- [x] Agent graceful shutdown — drain in-flight submissions + `health()` snapshot for Kubernetes probes
- [x] Telemetry provider — OpenTelemetry-compatible spans across all pipeline stages
- [x] Config validation — domain-aware checks (decimal mismatches, missing chains, mis-ordered thresholds)
- [x] Simulation staleness protection — rejects simulations older than the policy's threshold
- [x] Cap lock inspection — operational observability over outstanding locks
- [x] `ExecutionFailureReason` discriminated union — typed failure codes for executor / signing / broadcast
- [x] Property-based tests for the policy engine — fast-check, 1800 random iterations
- [x] EVM chain adapter with Tenderly simulation
- [x] Solana chain adapter
- [x] Cosmos chain adapter (Cosmos Hub, Osmosis)
- [x] Cap locking — absolute cap + rolling window
- [x] Redis CapLockProvider with atomic Lua scripts
- [x] Contract metadata verification
- [x] Pluggable receipt storage — memory, file, PostgreSQL, SQLite
- [x] Webhook-based human approval with HMAC signing
- [x] Notification system — console, webhook, composite
- [x] Dry-run mode with blocker report
- [x] MCP server with 11 tools
- [x] CLI with 13 commands
- [x] React hooks
- [x] Append-only audit log with policy snapshot immutability
- [x] On-chain reconciliation monitor with checkpoint persistence
- [x] Policy diff tool with CLI and MCP integration
- [x] Shared bigint serialization across all storage backends
- [x] Contract test suites for all core interfaces
- [x] Architecture decision records (12 ADRs in docs/decisions/)
- [x] Security model document
- [x] Operational runbook
- [x] GitHub Actions CI
- [x] End-to-end treasury agent example

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT

---
