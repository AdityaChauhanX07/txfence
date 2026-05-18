# txfence failure taxonomy

This document covers how **txfence itself can fail** — infrastructure failures, race conditions, and edge cases in the SDK's own components. This is distinct from [docs/failure-taxonomy.md](failure-taxonomy.md), which covers how autonomous agents fail.

Teams deploying txfence with real funds should understand these failure modes before going to production.

---

## 1. Receipt store write fails after transaction confirms

**What happens:** A transaction is broadcast and confirmed on-chain. The pipeline calls `receiptStore.save(receipt)` and it throws — disk full, database connection lost, file permission error. The transaction exists on-chain but txfence has no record of it.

**Detection:** The `@txfence/monitor` package will eventually detect this as an unrecorded transaction. The monitor scans blocks for transactions from known agent addresses and checks them against the receipt store. A confirmed transaction with no receipt will trigger `onUnrecordedTransaction` with `severity: 'warning'`, escalating to `'critical'` after the grace period.

**What txfence does:** The pipeline does not retry receipt writes, but it also does not let the error propagate cleanly. `receiptStore.save()` is called inside the executor's `try / catch` block. If it throws, the catch path converts the result to `{ status: 'execution_failed', txHash: '', reason: { code: 'executor_threw' } }` and the caller cannot distinguish this from a real executor failure. The transaction confirmed on-chain, but the real `txHash` is in the receipt that was thrown away, and the result reports `txHash: ''`. A secondary effect: the catch path also calls `capLockProvider.release()` for this run even though `commit()` already succeeded for the same lock, which briefly double-accounts the spend against the cap. This is a known SDK quirk. The transaction has already confirmed — there is nothing to roll back, but the result reporting is misleading.

**Mitigation:**
- Use a receipt store with durable storage (PostgreSQL, not file-based) for production
- Run `@txfence/monitor` alongside every production agent
- Implement an `onUnrecordedTransaction` handler that pages your on-call team
- Consider wrapping `receiptStore.save()` in a retry with exponential backoff in your executor

---

## 2. Redis goes down between cap lock acquire and commit

**What happens:** An agent acquires a cap lock (pending amount increases), the transaction executes successfully, and Redis crashes before `commit()` is called. On Redis restart, the pending amount is gone — the lock key expired or was lost. The absolute total was never incremented.

**Two sub-cases:**
- **Redis crashes after acquire, before execution:** The transaction never sent. On restart, the pending amount is gone. The cap appears to have more remaining than it does, but no money moved. Net effect: the cap is slightly more permissive than intended for one window.
- **Redis crashes after execution, before commit:** The transaction confirmed on-chain. On restart, neither pending nor committed reflects the spend. The cap thinks more budget remains than actually does. This is the dangerous case.

**Detection:** The monitor detects the confirmed transaction. The cap state does not reflect it. The discrepancy can be detected by comparing the audit log's committed spend against the cap's `inspect()` output.

**What txfence does:** txfence does not implement distributed transactions between the chain and Redis. These are two separate systems with no atomic commit protocol between them.

**Mitigation:**
- Use Redis Sentinel or Cluster with persistence enabled (AOF with `fsync: everysec` minimum)
- Implement a periodic reconciliation job that compares audit log spend against cap state
- Accept that the rolling window cap provides defense-in-depth — even if the absolute cap is briefly understated, the rolling window limits velocity
- This is a known limitation documented in the security model

---

## 3. Webhook endpoint unreachable during approval dispatch

**What happens:** An action exceeds `humanApprovalThreshold`. The pipeline calls `approvalProvider.request()` to dispatch the webhook. The webhook endpoint is unreachable — network partition, endpoint down, DNS failure. The `request()` call throws.

**What txfence does:** The error propagates up through `runPipeline`. The pipeline does not catch errors from `approvalProvider.request()`. The result is an unhandled error, not a graceful `approval_timeout`.

**Mitigation:**
- Wrap `approvalProvider.request()` in a try/catch in your custom `ApprovalProvider` implementation
- Implement retry logic with exponential backoff in the webhook provider
- Return `approval_timeout` gracefully when the webhook cannot be dispatched after retries
- Consider implementing a fallback notification channel (email, SMS) if the primary webhook fails
- The built-in `createWebhookApprovalProvider` does not retry — use it as a reference implementation and build your own for production

---

## 4. Audit log disk full or write failure

**What happens:** `auditLog.record()` is called after every pipeline decision. If the underlying write fails — disk full, permission error, file system error — the error propagates. The pipeline does not catch errors from audit log writes. If the audit log write happens after execution, the transaction has already confirmed with no audit record.

**What txfence does:** Audit log writes are `await`ed in the pipeline but not wrapped in try/catch. The record call runs *after* the inner pipeline has already computed its `ExecutionResult` — success, policy_rejected, simulation_failed, anything. If `auditLog.record()` throws at that point, the caller receives an exception instead of the result that was already produced. The pipeline outcome is silently discarded. This is the worst variant of audit failure: the chain may have moved, the cap lock may have committed, the receipt may have been stored, and the caller has no structured record of what happened or whether it succeeded.

**Mitigation:**
- Monitor disk usage on the machine running the file-based audit log
- Use the PostgreSQL receipt store for production — implement a PostgreSQL-backed `AuditLog` for durable audit storage
- Wrap your `AuditLog` implementation's `record()` in a try/catch that logs the failure but does not re-throw — an audit log failure should not abort an otherwise successful pipeline
- Consider a two-phase approach: write to a local buffer first, flush to durable storage asynchronously

---

## 5. Checkpoint file corrupted on monitor restart

**What happens:** The `@txfence/monitor` file checkpoint store reads `checkpoint.json` on startup. If the file is corrupted — manual edit, disk error, incomplete write from a previous run — `JSON.parse` throws and the monitor crashes on startup.

**What txfence does:** The write-then-rename pattern in `createFileCheckpointStore` prevents corruption from partial writes during normal operation. It does not protect against manual edits, disk hardware errors, or the `.tmp` file itself being corrupted before rename.

**Recovery options:**
- If the checkpoint file is corrupted and unrecoverable: delete it. The monitor will start from the current block, missing any transactions between the last good checkpoint and now. Check the audit log for that period manually.
- If you have a backup of the checkpoint file: restore it.
- For production: use a database-backed checkpoint store instead of file-based

**Mitigation:**
- Back up the checkpoint file periodically
- Use the file checkpoint store only for development and staging
- Implement a database-backed `CheckpointStore` for production deployments

---

## 6. Concurrent processes writing to the same file receipt store

**What happens:** Two agent processes both use `createFileReceiptStore` pointing to the same `.jsonl` file. Both call `save()` concurrently. POSIX `appendFileSync` is atomic for writes smaller than `PIPE_BUF` (typically 4096 bytes) on most systems, but a large receipt JSON could exceed this limit. Two concurrent large writes can interleave, producing a corrupted line that cannot be parsed.

**What txfence does:** The file receipt store and file audit log use `appendFileSync` without file locking. This is safe for single-process use. It is not safe for concurrent multi-process use.

**Mitigation:**
- Use the file-based stores only with a single writer process
- For multi-agent deployments: use the PostgreSQL receipt store and a PostgreSQL-backed audit log — database writes are atomic and concurrent-safe
- If you must use file-based stores with multiple processes: implement a file lock (e.g. using `proper-lockfile`) around the append operation

---

## 7. RPC node returns errors during simulation

**What happens:** `simulateEvmAction` calls `eth_call` or `eth_blockNumber` and the RPC node returns an error or times out.

**What txfence does:** `simulateEvmAction` wraps all RPC calls in a try/catch and returns a `SimulationResult` with `success: false` and `coverageLevel: 'none'`. The pipeline returns `{ status: 'simulation_failed' }`. No transaction is sent.

**This failure mode is handled correctly.** No mitigation required beyond having a backup RPC endpoint.

**Recommendation:** Configure multiple RPC endpoints and implement fallback logic in your chain adapter. The `ChainAdapter` interface accepts a single `rpcUrl` — implement a wrapping adapter that tries multiple endpoints on failure.

---

## 8. Simulation staleness — chain state changes between simulation and signing

**What happens:** Simulation runs at block N. By the time the transaction is signed and broadcast, the chain is at block N+5. The simulation's predictions are based on state that no longer exists.

**What txfence does:** txfence provides `simulationStalenessMs` in the policy — if more than the configured number of milliseconds pass between simulation completion and signing, the pipeline returns `{ status: 'simulation_stale' }` and the agent must re-simulate. This is optional; if not configured, no staleness check is performed.

**Mitigation:**
- Set `simulationStalenessMs` in your policy for volatile DeFi actions (recommended: 15000-30000ms)
- Use Tenderly simulation (`simulateWithTenderly`) for more accurate state snapshots
- Implement retry logic in your agent: on `simulation_stale`, re-simulate and resubmit

---

## 9. Provenance chain append fails

**What happens:** A pipeline run completes and the optional `@txfence/provenance` chain's `append()` method throws — disk full, JSONL corruption, permission error, or an in-memory chain hitting some custom internal limit.

**What txfence does:** Provenance recording is wrapped in an internal helper (`recordProvenance` in `pipeline.ts`) that catches the error, logs it to stderr as `[txfence] provenance recording failed:`, and swallows it. The pipeline continues and returns the actual `ExecutionResult` to the caller.

**This failure mode is handled correctly.** The tradeoff is that a provenance gap can appear without surfacing as a pipeline error. Operators relying on provenance for compliance evidence should monitor stderr for the warning line, or wrap their provenance chain implementation to emit a structured event when `append()` fails.

---

## 10. Event store record fails

**What happens:** The optional `EventStore` backing temporal rules throws from its `record()` method — for example, an in-memory store hitting a custom size limit, or a database-backed implementation losing its connection.

**What txfence does:** Event recording is wrapped in `recordPipelineEvent` in `pipeline.ts` with a silent try/catch. The pipeline never crashes due to event recording.

**This failure mode is handled correctly.** The side effect is that temporal rules dependent on the missed events evaluate against a thinner window for that period. If reliability of the event store is critical (for example, when temporal rules are the only line of defense against a behavioral attack), the operator should add their own observability around the underlying storage.

---

## 11. Notification provider throws

**What happens:** A `NotificationProvider.notify()` call rejects — webhook unreachable, HMAC signing error, downstream service overloaded. txfence emits `policy_rejected`, `execution_success`, `execution_failed`, `approval_requested`, `approval_decision`, `cap_warning`, `monitor_unrecorded`, and `monitor_reorg` events at the relevant pipeline points.

**What txfence does:** Every `notify()` call in the pipeline is invoked as `void notificationProvider?.notify({...})` — fire-and-forget, no `await`. A rejecting promise becomes an unhandled rejection in Node, which can crash the process under `--unhandled-rejections=strict` or surface as a warning in default mode. The pipeline itself does not block, fail, or change its result.

**Mitigation:**
- Wrap your `NotificationProvider` implementation's `notify()` in a try/catch that swallows or logs the error
- For the built-in `createWebhookNotificationProvider`, expect intermittent failures under network partition and ensure your downstream webhook endpoint tolerates retries from your own infrastructure
- Run the Node process with `--unhandled-rejections=warn` (the default) rather than `strict` until your providers are fully hardened

---

## Summary

| Failure mode | Txfence handles it? | Detection | Mitigation |
|---|---|---|---|
| Receipt write fails post-confirmation | No — caught as `execution_failed` with empty `txHash` | Monitor detects unrecorded tx | Retry wrapper in executor, durable storage, monitor |
| Redis down between acquire and commit | No — no distributed tx | Audit/cap reconciliation job | Redis persistence, reconciliation |
| Webhook endpoint unreachable | No — error propagates | Application logs | Retry in custom provider |
| Audit log write fails | No — error propagates, pipeline outcome discarded | Application logs | Catch-and-log wrapper, durable storage |
| Checkpoint file corrupted | Partial — write-then-rename prevents partial writes | Monitor crash on startup | Periodic backups, database-backed store |
| Concurrent file store writers | No — no file locking | Corrupted JSONL lines | Single writer, or PostgreSQL store |
| RPC errors during simulation | Yes — returns `simulation_failed` | Pipeline result status | Backup RPC endpoints |
| Simulation staleness | Yes — returns `simulation_stale` when configured | Pipeline result status | Set `simulationStalenessMs`, retry logic |
| Provenance append fails | Yes — caught, logged to stderr, swallowed | Stderr warning line | Wrap implementation to emit a structured event |
| Event store record fails | Yes — silently swallowed | None inside txfence | Add observability around your storage layer |
| Notification provider throws | Yes — fire-and-forget, doesn't block pipeline | Unhandled rejection in Node | Wrap `notify()` in try/catch inside the provider |
