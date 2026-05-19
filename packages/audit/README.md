# @txfence/audit

Append-only audit log for [txfence](https://github.com/AdityaChauhanX07/txfence) agent decisions. Captures every policy evaluation, simulation, approval request, and execution outcome — including rejections that never reach the chain.

## Why audit vs. receipt storage?

`@txfence/core`'s `ReceiptStore` only records successful on-chain transactions. The audit log captures everything:

| | `ReceiptStore` | `@txfence/audit` |
|---|---|---|
| Successful transactions | ✓ | ✓ |
| Policy rejections | ✗ | ✓ |
| Simulation failures | ✗ | ✓ |
| Approval requests / decisions | ✗ | ✓ |
| Execution failures | ✗ | ✓ |

Use `@txfence/audit` for compliance, debugging, and monitoring. Use `ReceiptStore` for querying confirmed on-chain state.

## Installation

```bash
pnpm add @txfence/audit
```

## Usage

```typescript
import { createMemoryAuditLog, createFileAuditLog } from '@txfence/audit'
import { runPipeline } from '@txfence/core'

// In-memory — development and testing
const auditLog = createMemoryAuditLog()

// File-backed NDJSON — production
const auditLog = createFileAuditLog('./audit.jsonl')

// Pass as the last argument to runPipeline
const result = await runPipeline(action, policy, adapters, rpcUrls, executor,
  undefined, undefined, undefined, undefined, auditLog)

// Query entries
const rejections = await auditLog.query({ status: 'policy_rejected' })
const ethTransfers = await auditLog.query({ chain: 'ethereum', actionKind: 'transfer' })
const recent = await auditLog.query({ from: Date.now() - 86_400_000 })
```

## AuditEntry shape

```typescript
type AuditEntry = {
  id: string                      // UUID generated per pipeline call
  timestamp: number               // Date.now() at time of recording
  action: Action                  // The action that was submitted
  policySnapshot: Policy          // Deep clone of the policy at evaluation time
  evaluation: PolicyEvaluation    // Result of policy checks
  simulation?: SimulationResult   // Present when requireSimulation: true
  approvalRequest?: ApprovalRequest  // Present when human approval was triggered
  approvalDecision?: ApprovalDecision  // 'approved' | 'rejected' | absent on timeout
  outcome: AuditOutcome           // Final result of the pipeline run
}
```

### AuditOutcome variants

```typescript
| { status: 'success'; txHash: string; confirmedAtBlock: number; gasUsed: string }
| { status: 'policy_rejected'; reason: PolicyRejectionReason | undefined }
| { status: 'simulation_failed' }
| { status: 'approval_timeout' }
| { status: 'execution_failed'; reason: string }
| { status: 'dry_run'; stoppedAt: 'policy' | 'simulation' | 'approval' | 'execution' }
```

`gasUsed` is stored as a decimal string — not a bigint — because the audit log is serialized to JSON and bigint values are not JSON-native. The `ReceiptStore`'s `SuccessReceipt` stores `gasUsed` as bigint; the audit log intentionally keeps it as a string for interoperability.

## Filtering

```typescript
type AuditFilter = {
  chain?: ChainId              // filter by action chain
  from?: number                // timestamp >= from (milliseconds)
  to?: number                  // timestamp <= to (milliseconds)
  status?: AuditOutcome['status']  // filter by outcome status
  actionKind?: Action['kind']  // 'transfer' | 'swap' | 'contract_call'
}
```

## Implementations

### Memory (development)

```typescript
const log = createMemoryAuditLog()
```

Stores entries in a plain array. Not persisted across process restarts. Ideal for tests and development.

### File (production)

```typescript
const log = createFileAuditLog('./audit.jsonl')
```

Appends one JSON line per entry to an NDJSON file. The directory is created automatically. The file is never rewritten — only appended — making it safe under concurrent reads.

**NDJSON format**: one JSON object per line, each terminated with `\n`. Standard tools like `jq` work on NDJSON:

```bash
# Show all policy rejections
cat audit.jsonl | jq 'select(.outcome.status == "policy_rejected")'

# Count outcomes by status
cat audit.jsonl | jq -r '.outcome.status' | sort | uniq -c
```

## Bigint serialization

`Policy`, `Action`, and `SimulationResult` contain `bigint` fields (token amounts, gas estimates). These are serialized as decimal strings in the NDJSON file and revived back to `bigint` on read. The `policySnapshot` is deep-cloned on `record()` to prevent mutation after the fact.

## Known limitation: no tamper evidence in v1

The file backend is append-only but does not chain entries with hashes. A determined attacker with filesystem access can edit historical entries. Teams with strict tamper-evidence requirements should use a write-once storage backend (e.g. S3 with object lock) for the NDJSON file. Hash chaining is a planned future addition.
