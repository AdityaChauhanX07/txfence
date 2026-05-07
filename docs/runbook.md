# txfence runbook

Troubleshooting guide for txfence agents in production. Each section covers a specific error or rejection reason, what causes it, and what to check.

---

## Policy rejections

### `chain_not_allowed`

**What happened:** The action targeted a chain that is not in `policy.chains`.

**Check:**
- What chain did the action specify? (`result.evaluation` shows which check failed)
- What chains does the policy allow? (`policy.chains`)
- Did the agent configuration change recently? A deployment may have updated the policy without updating the allowed chains.
- Is the action being submitted to the wrong agent instance?

**Fix:** Add the chain to `policy.chains`, or ensure the action targets a chain the policy permits.

---

### `contract_not_allowed`

**What happened:** The action targeted a contract address not in `policy.allowedContracts` for the action's chain.

**Check:**
- What contract did the action target? (SwapAction: `action.via`, ContractCallAction: `action.contract`)
- Is the contract on the allowlist for the correct chain? An address on the allowlist for `ethereum` does not apply to `arbitrum`.
- Was the contract recently deployed or updated? A new deployment address is not automatically added to the allowlist.
- Was the allowlist recently changed? A deployment may have removed the contract.

**Fix:** Add the contract address to `policy.allowedContracts` with the correct `chain` field. If using metadata verification, also set `bytecodeHash` and `ownerAddress`.

---

### `contract_entry_expired`

**What happened:** The contract is on the allowlist but its `expiresAt` timestamp has passed.

**Check:**
- When did the entry expire? (`policy.allowedContracts` entry's `expiresAt`)
- Is the contract still safe to interact with? Expiry entries are designed to force periodic review.
- Has the contract been audited, upgraded, or transferred since the entry was created?

**Fix:** Review the contract, then update the allowlist entry with a new `expiresAt` or remove the timestamp if ongoing access is required.

---

### `bytecode_hash_mismatch`

**What happened:** The contract's current bytecode hash does not match the pinned value in `policy.allowedContracts`.

**What this means:** The contract implementation has changed since the allowlist entry was created. This happens when:
- The contract was upgraded through a proxy pattern
- The contract was replaced at the same address (rare but possible with CREATE2)
- The contract self-destructed and was redeployed

**Check:**
- Was the contract intentionally upgraded? Verify the upgrade was authorized.
- Was the upgrade expected? If so, update the `bytecodeHash` in the allowlist entry.
- If the upgrade was not expected, treat this as a potential security incident.

**Fix (if upgrade was authorized):** Fetch the new bytecode hash and update `policy.allowedContracts`. Never update the hash without reviewing what changed in the implementation.

---

### `owner_address_mismatch`

**What happened:** The contract's current owner does not match the pinned `ownerAddress` in `policy.allowedContracts`.

**What this means:** Contract ownership has been transferred since the allowlist entry was created.

**Check:**
- Was the ownership transfer authorized by your organization?
- Who is the new owner? Fetch the current owner address from the chain.
- Is the new owner a trusted entity?

**Fix (if transfer was authorized):** Update `ownerAddress` in the allowlist entry after verifying the new owner is trusted. If the transfer was unexpected, treat this as a potential security incident and pause the agent.

---

### `spend_exceeds_cap`

**What happened:** The action's spend amount exceeds `policy.maxSpendPerTx`.

**Check:**
- What amount did the action attempt to spend? (visible in `action.token.amount` or `action.from.amount`)
- What is the current cap? (`policy.maxSpendPerTx.amount`)
- Is the cap appropriate for the action? The cap may have been set for a different use case.
- Are the token decimals correct? A mismatch in decimals is a common cause — 1 USDC is `1_000_000n` (6 decimals), not `1n`.

**Fix:** Either reduce the action's spend amount, or increase `maxSpendPerTx` in the policy after review.

---

### `slippage_not_declared`

**What happened:** A swap action was submitted with `maxSlippage: 0`, which txfence treats as undeclared.

**Check:**
- Was `maxSlippage` set in the action? Zero is treated as not declared, not as zero tolerance.
- Is the action construction code setting slippage correctly?
- Did a recent code change zero out the slippage field?

**Fix:** Set `maxSlippage` to a non-zero value in basis points. For example, `50` means 0.5% maximum slippage. A value of `0` is always rejected.

---

### `simulation_required_but_failed`

**What happened:** `policy.requireSimulation` is `true`, but either no simulation was provided or the simulation returned `success: false`.

**Check:**
- Did the simulation run? Check if `simulationResult` is present in the pipeline result.
- If simulation ran, why did it fail? (`result.simulation.wouldRevert`, `result.simulation.revertReason`)
- Is the RPC endpoint reachable? Simulation failures often indicate RPC connectivity issues.
- Is the action valid on-chain? A simulation that reverts usually means the transaction would fail.

**Fix:**
- If the RPC is unreachable: check the endpoint URL and network connectivity.
- If the transaction would revert: investigate the revert reason and fix the action parameters.
- If simulation is incorrectly required: review whether `requireSimulation: true` is appropriate for this action type.

---

### `gas_buffer_insufficient`

**What happened:** The simulation's `gasBufferApplied` is below `policy.gasBufferMultiplier`.

**What this means:** The simulation ran but the gas buffer applied was less than the policy requires. This can happen when:
- The simulation provider applied a lower buffer than the policy expects
- The `gasBufferMultiplier` was recently increased in the policy
- A custom adapter returned a simulation result with a lower buffer

**Check:**
- What buffer did the simulation apply? (`result.simulation.gasBufferApplied`)
- What does the policy require? (`policy.gasBufferMultiplier`)
- Is the policy's multiplier realistic? Values above 2.0 are rarely necessary.

**Fix:** Either reduce `policy.gasBufferMultiplier` to match what your simulation provider applies, or configure your simulation provider to apply a higher buffer.

---

### `cap_lock_unavailable`

**What happened:** The spend cap lock could not be acquired. Another agent reached the cap limit before this one.

**Check:**
- Which cap was exhausted? (`policy.capLocks` — check the `capId` values)
- Is this a rolling window cap or an absolute cap? Rolling window caps reset automatically; absolute caps require manual reset.
- Are multiple agents running concurrently against the same cap?
- Is the cap limit set appropriately for the expected transaction volume?

**Fix:**
- If the cap is too low for legitimate usage: increase `absoluteCap.maxAmount` or `rollingWindow.maxAmount`.
- If the cap was hit by unexpected volume: investigate what caused the spike before resetting.
- If this is a rolling window cap: wait for the window to expire and the cap to reset automatically.

---

### `chain_id_mismatch`

**What happened:** The chain ID returned by the connected RPC provider does not match the expected chain.

**What this means:** The RPC endpoint is connected to a different chain than configured. This can happen when:
- The RPC URL was changed to a different network endpoint
- A testnet RPC was accidentally configured for a mainnet agent
- The RPC provider switched chains during a maintenance window

**Check:**
- What chain does the RPC report? Call `eth_chainId` on the endpoint manually.
- What chain does the policy expect?
- Was the RPC URL recently changed?

**Fix:** Update the RPC URL to point to the correct chain, or update the policy to match the connected chain.

---

## Simulation issues

### Simulation passes but execution fails

**What happened:** The transaction succeeded in simulation but reverted on-chain.

**Why this happens:** Simulation is a snapshot against a specific block. Chain state changes between simulation and execution — price movements, liquidity changes, competing transactions in the same block.

**Check:**
- What is `result.simulation.caveats`? `state_may_diverge` is always present — this is expected.
- How much time passed between simulation and execution?
- Was there high MEV activity in the relevant block?

**Fix:**
- Tighten slippage tolerance to limit damage from price divergence.
- Use Tenderly simulation (`simulateWithTenderly`) for more accurate pre-execution checks.
- Reduce the window between simulation and signing.

---

### Simulation fails with `wouldRevert: true`

**What happened:** The simulation indicates the transaction would revert on-chain.

**Check:**
- What is `result.simulation.revertReason`? This contains the revert message if available.
- Is the action's input data correct? Wrong calldata is the most common cause.
- Does the agent address have sufficient token balance and approval?
- Is the contract in a state that allows this operation?

**Fix:** Investigate the revert reason and fix the action parameters before resubmitting.

---

## Approval issues

### Agent returns `approval_timeout`

**What happened:** Either no `ApprovalProvider` was configured and the action exceeded `humanApprovalThreshold`, or the approval window expired without a decision.

**Check:**
- Is an `ApprovalProvider` configured on the agent?
- Did the approval webhook reach the receiver? Check webhook delivery logs.
- Did the approver receive the notification?
- Did the approver respond within `humanApprovalTimeoutMs`?

**Fix:**
- If no provider is configured: add `createWebhookApprovalProvider` to the agent.
- If the webhook is not being received: check the webhook URL, firewall rules, and receiver logs.
- If the timeout is too short: increase `humanApprovalTimeoutMs`.
- If the approver missed it: resubmit the action and ensure the approver is available.

---

## Monitor alerts

### `severity: warning` — unrecorded transaction

**What happened:** The monitor detected a transaction from a known agent address that is not in the receipt store. It has been seen on-chain but not yet committed to the receipt store within the grace period.

**This may be:**
- A timing issue — the monitor polled faster than the pipeline recorded the receipt
- A receipt recording failure — the pipeline executed but failed to write to the store
- Out-of-band execution — a transaction was signed and sent outside the txfence pipeline

**Check:**
- Is the transaction now in the receipt store? Wait for the grace period to expire and check again.
- Did the pipeline return `execution_failed` for this transaction hash?
- Are there any errors in the receipt store write logs?

**Action:** Monitor the transaction. If it escalates to `critical`, treat it as a potential incident.

---

### `severity: critical` — unrecorded transaction

**What happened:** The monitor detected a transaction from a known agent address that has been confirmed on-chain but is not in the receipt store, and the grace period has expired.

**This is a potential security incident.**

**Immediate actions:**
1. Pause the agent — stop submitting new transactions until the source of the unrecorded transaction is understood.
2. Identify the transaction — fetch the full transaction details from the chain using the `txHash` in the event.
3. Determine the source — was this transaction signed by a txfence agent, or by something else with access to the signing key?
4. Check the audit log — does the `@txfence/audit` log show this transaction being submitted?
5. If the signing key is compromised: rotate the key immediately and revoke the old one.

**Do not resume the agent until the source of the unrecorded transaction is understood.**

---

### Reorg detected

**What happened:** A transaction that txfence recorded as confirmed is no longer at the expected block number on-chain.

**What this means:** A chain reorganization occurred after the receipt was recorded. The transaction may have been re-mined in a different block, or may no longer be included in the canonical chain.

**Check:**
- Is the transaction still in the mempool? It may be pending re-inclusion.
- Was the transaction re-mined in a different block? Check the current transaction receipt on-chain.
- Was the transaction dropped entirely? It may need to be resubmitted.

**Fix:**
- If re-mined: update your records with the new block number.
- If dropped: resubmit the transaction and monitor for inclusion.
- Deep reorgs (more than 2-3 blocks) are rare on Ethereum mainnet but more common on some L2s.

---

## Common configuration mistakes

### Token decimals mismatch

**Symptom:** Actions are rejected for `spend_exceeds_cap` or pass unexpectedly.

**Cause:** The `decimals` field on `TokenAmount` must match the token's actual decimals. USDC has 6 decimals, ETH has 18. Setting `amount: 1000n` with `decimals: 18` means 0.000000000000001 ETH, not 1000 ETH.

**Fix:** Always verify `decimals` matches the token. Use `1_000_000n` for 1 USDC (6 decimals), `1_000_000_000_000_000_000n` for 1 ETH (18 decimals).

---

### Wrong chain in allowedContracts

**Symptom:** Actions targeting a valid contract are rejected with `contract_not_allowed`.

**Cause:** The contract is on the allowlist but for a different chain. An entry with `chain: 'ethereum'` does not apply to `arbitrum` even if the contract is deployed at the same address on both chains.

**Fix:** Add a separate allowlist entry for each chain the contract is deployed on.

---

### Public RPC node rate limiting in monitor

**Symptom:** The monitor produces errors or skips blocks.

**Cause:** Public RPC nodes rate-limit requests. Block scanning (fetching full blocks with transactions) is RPC-intensive. Under continuous polling, public nodes will throttle or reject requests.

**Fix:** Use a dedicated RPC endpoint from Alchemy, Infura, or another provider. Set `maxBlocksPerPoll` to 1-2 on public nodes if a dedicated endpoint is not immediately available.
