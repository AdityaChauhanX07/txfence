# txfence security model

This document describes the threat model for txfence, what the SDK protects against, and what it does not protect against. Teams deploying txfence in production should read this before doing so.

---

## Threat model

txfence is designed to protect against **policy failures** — cases where an autonomous agent executes an action that was not intended by the humans who configured it. This includes:

- An agent spending more than the declared limit per transaction
- An agent interacting with a contract not on the allowlist
- An agent executing a transaction that simulation indicated would fail
- An agent executing without human approval when the spend exceeds the approval threshold
- Two agents simultaneously exhausting a shared spend cap
- A transaction executing on a chain the agent was not configured for

txfence is **not** a general security tool. It does not protect against all threat vectors. The threats below are explicitly out of scope.

---

## What txfence protects against

### Policy enforcement

**Spend cap enforcement** — `maxSpendPerTx` is enforced at the policy evaluation layer before signing. An action whose spend exceeds the cap is rejected before a transaction is built. This protection is structural: the bound is encoded in the policy check, not in application code.

**Contract allowlist** — actions targeting contracts not on `allowedContracts` are rejected before simulation runs. Optional metadata verification (bytecode hash, owner address, expiry timestamp) can detect contracts that have been upgraded, transferred, or deprecated since the entry was created.

**Chain scoping** — actions targeting a chain not in `policy.chains` are rejected immediately. Chain ID is verified against the connected provider before every signing operation, preventing cross-chain intent replay.

**Slippage enforcement** — swap actions without a declared `maxSlippage` are rejected. When slippage is declared, it is encoded into the transaction at signing time, not as an advisory check.

**Simulation before execution** — when `requireSimulation: true`, the pipeline will not proceed to signing unless simulation succeeds. Simulation coverage level and caveats are recorded in the receipt so consumers know exactly what the simulation did and did not cover.

**Human approval threshold** — when spend exceeds `humanApprovalThreshold`, the pipeline dispatches a webhook and waits for an explicit approval. Cancel-on-timeout is the hard default: if the approval window expires without a response, the transaction is dropped. This default is not configurable.

**Cap locking for multi-agent environments** — the `CapLockProvider` interface and its implementations use two-phase acquire/commit/release to prevent concurrent agents from collectively exceeding a shared cap. The in-memory implementation is safe within a single process. The Redis implementation uses atomic Lua scripts for safety across processes.

### Webhook security

**HMAC-SHA256 payload signing** — webhook payloads dispatched by `createWebhookApprovalProvider` include an `X-TXFence-Signature` header containing an HMAC-SHA256 signature of the payload body. Receivers should verify this signature before trusting the payload. Without verification, an attacker who knows the webhook URL can send fake approval requests.

### Audit trail

**Append-only audit log** — `@txfence/audit` records every pipeline decision regardless of outcome, including rejections that never reach the chain. The `policySnapshot` field captures the policy at decision time via deep clone, ensuring the record is immutable even if the caller mutates the policy object afterward.

### On-chain reconciliation

**Unrecorded transaction detection** — `@txfence/monitor` scans blocks for transactions from known agent addresses and checks them against the receipt store. Transactions that appear on-chain but were not recorded by txfence trigger an alert. This is the primary detection mechanism for signing key compromise.

**Chain reorganization detection** — the monitor performs reverse reconciliation, checking that recorded receipts still exist at the expected block number. Block number mismatches indicate a chain reorganization after the receipt was recorded.

---

## What txfence does not protect against

### Signing key compromise

If a private key used by a txfence agent is compromised, an attacker can sign and broadcast transactions that bypass the policy engine entirely. The policy engine operates before signing — it cannot inspect or reject transactions signed outside the txfence pipeline.

**Mitigation:** Use hardware security modules (HSMs), key management services (KMS), or multisig schemes for production signing keys. The `@txfence/monitor` package detects transactions from known agent addresses that were not recorded by txfence — this is the detection mechanism, not prevention.

### Simulation-execution divergence

Chain state changes between simulation time and execution time. A simulation that passes is evidence that the transaction would have succeeded at a specific moment in the past, not a guarantee of success at execution time. Sandwich attacks, concurrent liquidity withdrawals, and other MEV strategies can cause divergence.

**Mitigation:** The policy engine enforces output bounds (slippage caps, minimum output amounts) that limit the damage when divergence occurs. These bounds are encoded in the transaction at signing time and enforced by the chain itself. Tenderly simulation (`coverageLevel: 'deep'`) provides more accurate simulation but does not eliminate divergence risk.

### Smart contract exploits

txfence verifies that a contract address is on the allowlist and optionally verifies its bytecode hash and owner address. It does not verify that the contract's logic is correct or unexploitable. A contract that passes all metadata checks can still be exploited if it contains a vulnerability.

**Mitigation:** Use contract allowlists with bytecode hash pinning. Set `expiresAt` on allowlist entries to force periodic review. Monitor contract ownership for unexpected transfers.

### Post-confirmation failures

txfence operates in the pre-signing and pre-broadcast window. Once a transaction is confirmed on-chain, it is outside txfence's scope. Failed transactions that consumed gas, partial state changes from out-of-gas reverts, and on-chain events triggered by the transaction are not tracked or mitigated by txfence.

### Malicious policy configuration

txfence enforces the policy it is given. If the policy itself is misconfigured — too-high spend caps, overly broad allowlists, missing simulation requirements — txfence will enforce those misconfigured rules faithfully. The SDK cannot detect policy configuration errors.

**Mitigation:** Use `txfence diff` to compare policy changes before deploying them. Use `createTestActions` to generate a covering set of actions and verify the policy behaves as expected. Review policy changes in code review like any other security-sensitive configuration.

### MCP tool misuse

The `txfence_submit` MCP tool defaults to `dryRun: true`. Setting `dryRun: false` triggers real execution. An AI assistant that misunderstands user intent could call `txfence_submit` with `dryRun: false` when the user expected a dry run. The two-step pattern (dry run then confirm) is the recommended usage but is not enforced by the SDK.

**Mitigation:** Configure the MCP server's base policy conservatively. Use `humanApprovalThreshold` to require explicit approval for high-value transactions. Review MCP server logs and the audit log for unexpected submissions.

### Redis cluster failover during Lua script execution

The Redis cap lock implementation uses atomic Lua scripts for acquire, commit, and release. In a Redis cluster failover scenario where the primary fails mid-script-execution, the Lua script may be partially applied. This could result in a cap lock that is acquired but never released, or a committed amount that is not reflected in the absolute total.

**Known limitation:** This scenario is documented as a known limitation. Teams requiring strict correctness under Redis cluster failover should implement a periodic reconciliation job that compares the Redis cap state against the audit log.

---

## Webhook verification

Teams receiving txfence approval webhooks should verify the `X-TXFence-Signature` header before processing the request:

```typescript
import { createHmac } from 'crypto'

function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return signature === expected
}
```

Call this before trusting any fields in the webhook payload.

---

## Audit log tamper evidence

The file-based `@txfence/audit` backend is append-only but does not chain entries with hashes. A determined attacker with file system access can edit entries without detection. Teams with strict tamper-evidence requirements should:

1. Use a write-once storage backend (S3 with object lock, WORM storage) for the audit log file
2. Or implement a hash-chaining audit log backend (planned for a future release)

---

## Reporting security issues

If you discover a security vulnerability in txfence, please open a GitHub issue with the label `security`. Do not include exploit details in the public issue — describe the vulnerability category and we will follow up privately.
