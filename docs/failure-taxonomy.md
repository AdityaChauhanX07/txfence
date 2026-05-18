# Agent failure taxonomy

This document catalogs every known failure mode for autonomous agents executing transactions on-chain. It is a design input for txfence — every policy primitive, simulation contract, and safety guarantee in the SDK traces back to at least one entry here. It is also a reference for builders using txfence, so they understand precisely what the SDK protects against and where the boundaries of that protection are. No SDK eliminates all risk. This document is honest about that.

This document covers how **agents** fail. For how **txfence itself** can fail (infrastructure failures, race conditions, and edge cases in the SDK's own components), see [docs/txfence-failure-taxonomy.md](txfence-failure-taxonomy.md).

---

## Summary

| # | Failure Mode | Can simulation catch it? | Can the policy engine prevent it? |
|---|---|---|---|
| 1 | Simulation-execution divergence | No | Partially — bounds the damage |
| 2 | Slippage overrun | No | Yes — enforced at signing |
| 3 | Unintended proxy target | No | Yes — with implementation hash pinning |
| 4 | Spend cap race condition | No | Yes — with cap locking |
| 5 | Cross-chain intent replay | No | Yes — chain scoping at policy level |
| 6 | Approval timeout default | No | Yes — cancel-on-timeout is the hard default |
| 7 | Stale allowlist | Partially | Partially — with metadata verification |
| 8 | Gas estimation failure | Partially | Partially — minimum buffer multiplier enforced |
| 9 | MEV sandwich attack | No | Yes — with Flashbots or MEV Blocker routing |
| 10 | Unauthorized approval execution | No | Yes — HMAC-signed webhooks, cancel-on-timeout |
| 11 | Audit trail tampering | No | Yes — hash-chained provenance with Merkle proofs |
| 12 | Behavioral pattern attacks | No | Yes — temporal rules with sliding-window detection |
| 13 | Multi-step intent partial failure | Partially | Yes — DAG execution with dependency management |
| 14 | Policy configuration bug | No | Yes — formal verification and adversarial stress testing |

---

## 1. Simulation-execution divergence

**What happens:** The transaction simulates successfully but executes against different state. The output differs from what simulation predicted, or the transaction reverts entirely.

**Root cause:** Simulation is a snapshot. It runs against chain state at a specific block. By the time your transaction is included, other transactions have already modified that state. On EVM, a sandwich attack or a concurrent liquidity withdrawal can move the pool state between your simulation and your inclusion. On Solana, account state can change between simulation and the slot your transaction lands in, and the recent blockhash window is short enough that this window is meaningful.

**What simulation catches:** Failures that would occur against the state at simulation time. Nothing about state at execution time.

**What the policy engine can enforce:** txfence enforces output bounds at the policy layer, not the simulation layer. You declare a minimum acceptable output and the signed transaction encodes that bound. If execution would violate it, the transaction reverts on-chain. Simulation tells you the expected output. The policy bound is what actually protects you.

---

## 2. Slippage overrun

**What happens:** A swap executes at a price significantly worse than intended. The agent accepted the execution because no slippage bound was enforced in the signing flow.

**Root cause:** Most agent frameworks treat slippage as a UI concern, not a signing concern. The bound exists in the interface but not in the transaction itself. An autonomous agent has no UI layer, so if the bound is not encoded in the transaction parameters, it does not exist at execution time.

**What simulation catches:** The slippage at simulation time. Not the slippage at execution time.

**What the policy engine can enforce:** txfence requires slippage tolerance to be declared at the policy level and encodes it into the transaction before signing. An agent cannot submit a swap without a bound. The bound is not advisory, it is structural.

---

## 3. Unintended proxy target

**What happens:** An agent simulates against contract A. Between simulation and execution, contract A is upgraded through a proxy pattern. The agent signs and broadcasts, and the transaction executes against contract B, the new implementation.

**Root cause:** EVM proxy patterns (TransparentProxy, UUPS) separate the address the agent interacts with from the implementation that runs. Simulation resolves the implementation at simulation time. If an upgrade happens in the window between simulation and execution, the agent has no visibility into it.

**What simulation catches:** The behavior of the implementation at simulation time. Upgrades that happen after simulation are invisible to it.

**What the policy engine can enforce:** txfence maintains an allowlist of contract addresses with optional implementation hash pinning. If implementation hash pinning is enabled for a contract, txfence checks the current implementation hash before signing and refuses to proceed if it does not match the pinned value. This adds a pre-signing RPC call but eliminates the upgrade window risk.

---

## 4. Spend cap race condition

**What happens:** Two agents read the same spend cap, both see available budget, both pass the policy check, and both execute. The effective spend is double the declared cap.

**Root cause:** Spend caps enforced in application memory are not atomic. In a multi-agent environment where two agents share a cap, the read-check-execute sequence is not protected against concurrent reads. Both agents read before either writes back.

**What simulation catches:** Nothing. Both transactions simulate successfully against the same state.

**What the policy engine can enforce:** txfence exposes a cap locking interface. Before a transaction is signed, the agent acquires a cap lock for the spend amount. The lock is released when the transaction is confirmed or fails. A second agent attempting to acquire a lock that would breach the cap is rejected before simulation runs. For single-agent deployments this is not relevant. For multi-agent treasury management it is the difference between controlled and uncontrolled spend.

---

## 5. Cross-chain intent replay

**What happens:** A signed transaction or intent is valid on more than one chain and gets replayed on a chain the agent did not intend to target.

**Root cause:** EVM chains share the same address space and signing scheme. A transaction signed for Arbitrum can be replayed on Base or Optimism if chain ID scoping is missing or incorrect in the signing flow. This is less common with modern tooling but reappears in custom signing flows, meta-transactions, and off-chain intent systems that do not enforce chain scoping at the signature level.

**What simulation catches:** Nothing. The transaction is valid on the unintended chain.

**What the policy engine can enforce:** txfence enforces chain scoping at the policy declaration level. An agent is initialized with an explicit chain set and cannot sign a transaction for a chain outside that set. Chain ID is verified against the connected provider before every signing operation. Intents are bound to a chain at construction time and cannot be re-submitted to a different chain.

---

## 6. Approval timeout default

**What happens:** A transaction exceeds the human approval threshold and is sent to a human approver. The approver does not respond within the timeout window. The system defaults to executing the transaction rather than canceling it.

**Root cause:** Defaulting to execute on timeout is the path of least resistance in most implementations. The agent was trying to do something, the human did not explicitly say no, so the system proceeds. In a financial context this is the wrong default. Irreversible on-chain actions should require explicit approval, not the absence of rejection.

**What simulation catches:** Nothing. This is a policy design failure, not a transaction failure.

**What the policy engine can enforce:** txfence defaults to cancel on timeout, not execute. This is a hard default and not configurable to execute-on-timeout. If a human approval window expires without a response, the transaction is dropped and the agent receives a timeout rejection it must handle explicitly. An agent that cannot handle approval timeouts cannot use the human-in-the-loop feature.

---

## 7. Stale allowlist

**What happens:** An agent interacts with a contract that is on its allowlist but has since been exploited, deprecated, or transferred to a new owner. The policy check passes because the address is allowed. The interaction causes loss.

**Root cause:** Allowlists are static by default. A contract address that was safe at the time of policy configuration may not be safe at execution time. Protocols get exploited. Contracts get migrated. Ownership gets transferred. None of these events automatically invalidate an allowlist entry.

**What simulation catches:** If the exploit or deprecation has already occurred before simulation, simulation may catch unexpected behavior. If it occurs after simulation, nothing is caught.

**What the policy engine can enforce:** txfence supports allowlist entries with optional metadata: the expected contract owner address, the expected bytecode hash, and an optional expiry timestamp. Before signing, txfence can verify that the current on-chain state of the contract matches the declared metadata. This does not prevent zero-day exploits but it catches ownership transfers, migrations, and self-destructs before the agent interacts with a contract that is no longer what it was when it was allowlisted.

---

## 8. Gas estimation failure

**What happens:** An agent submits a transaction with an underestimated gas limit. The transaction runs out of gas mid-execution, reverts, but the gas fee is still consumed. Depending on the protocol, partial state changes may or may not persist.

**Root cause:** Gas estimation is a simulation-time estimate against simulation-time state. If the execution path changes due to state divergence, the actual gas consumption can exceed the estimate. Agents that apply aggressive gas buffers reduce the risk but increase the cost of every transaction. Agents that apply no buffer trade reliability for cost.

**What simulation catches:** The gas consumption of the simulated execution path. Not the gas consumption of the actual execution path if state has diverged.

**What the policy engine can enforce:** txfence enforces a minimum gas buffer multiplier at the policy level. The default is 1.2x the simulation estimate. Builders can increase it per action type. txfence will not sign a transaction where the gas limit is below the buffered estimate. The buffer is declared and visible in the receipt, so consumers know exactly what multiplier was applied.

---

## 9. MEV sandwich attack

**What happens:** A swap is broadcast to the public mempool. A searcher sees the pending transaction, front-runs it with a buy on the same pool, lets the agent's transaction execute at a worse price, then back-runs with a sell. The agent loses the price difference to the sandwich.

**Root cause:** EVM public mempools are observable. Any party watching the mempool can identify profitable sandwich opportunities and assemble three-transaction bundles atomically. The agent has no protection at the transport layer if it broadcasts through a public RPC.

**What simulation catches:** Nothing about MEV. Simulation runs against current state; the sandwich is constructed at broadcast time and lands in the same block as the agent's transaction.

**What the policy engine can enforce:** txfence supports per-transaction MEV protection via `Policy.mevProtection`. Setting it to `'flashbots'` routes broadcasts through Flashbots Protect, which submits to builders directly and bypasses the public mempool. Setting it to `'mev-blocker'` routes through CoW Protocol's MEV Blocker. Both prevent the pending-transaction observation step that a sandwich attack depends on. The setting is per-transaction, so swaps can use Flashbots while internal transfers use the default path. EVM only; Solana and Cosmos adapters ignore the field.

---

## 10. Unauthorized approval execution

**What happens:** A transaction exceeds the human approval threshold and the agent dispatches a webhook to a human approver. An attacker who can reach the polling endpoint sends a forged approval response. The agent treats the forged response as legitimate and executes a transaction that no human ever sanctioned.

**Root cause:** Webhook channels are not inherently authenticated. Anyone with the polling URL and the approval token can post a decision. Without payload signing on the dispatch side and signature verification on the receive side, the approval system is a public message bus.

**What simulation catches:** Nothing. The transaction simulates and would execute correctly; the question is who authorized it, not whether it would succeed.

**What the policy engine can enforce:** `createWebhookApprovalProvider` signs every outbound webhook payload with HMAC-SHA256 using a shared secret. Receivers verify the `X-TXFence-Signature` header before trusting the payload. The poll endpoint uses a token that the agent generated, so an attacker without the secret cannot forge decisions even if they can guess the URL. Cancel-on-timeout is the hard default: if no valid approval arrives within the window, the transaction is dropped rather than silently executed. The default is not configurable to execute-on-timeout.

---

## 11. Audit trail tampering

**What happens:** An attacker with write access to the audit log edits or removes historical entries to hide an unauthorized transaction. A compliance review afterward finds nothing wrong because the record was cleaned. The same problem applies in reverse: an attacker plants fake entries to discredit a legitimate operation.

**Root cause:** Plain append-only logs are append-only by convention, not by cryptographic guarantee. A file system attacker can rewrite history. Write-once storage backends (S3 with object lock, WORM storage) help, but are not always practical, and they only protect against modification of past entries — not against an attacker who controls the system before a record is written.

**What simulation catches:** Nothing. This is a post-execution evidence-integrity problem, not a transaction property.

**What the policy engine can enforce:** `@txfence/provenance` extends the audit story with hash-chained records. Every authorization decision is linked to the SHA-256 hash of the previous record. Modifying any historical entry invalidates every record after it, and `chain.verify()` detects the violation and reports the specific `hash_mismatch`, `chain_broken`, or `invalid_hash` failure. Merkle proofs allow a compliance team to prove a specific record exists without exposing the rest of the chain. The CLI command `txfence provenance verify` exits non-zero on any integrity violation, so the integrity check can be wired into a scheduled job.

---

## 12. Behavioral pattern attacks

**What happens:** An attacker who cannot exceed the per-transaction spend cap submits a steady stream of below-cap transactions. Over a window, the cumulative spend exhausts the agent's funds. Or: an attacker drives the agent into a sequence of failures to mask a later successful attack. Or: an attacker floods the approval channel to wear down the human approver. Each individual action passes every static check.

**Root cause:** Per-transaction policy checks are stateless. They cannot detect patterns that emerge across many transactions. A cap on each spend says nothing about velocity across an hour. An allowlist says nothing about how often a contract is being called. A stateless policy is structurally blind to anything that requires correlating events.

**What simulation catches:** Nothing. Each transaction simulates correctly. The pattern is across transactions, not within one.

**What the policy engine can enforce:** `policy.temporalRules` evaluates six predicate kinds against an `EventStore` of recent pipeline outcomes. `spend_velocity` caps cumulative spend within a window. `simulation_failure_rate` triggers when simulations fail more than N times in a window. `contract_call_frequency` caps how often a specific contract may be called. `consecutive_failures` triggers when the last N events are all non-success. `success_drought` triggers when too few successes occur in a window (a stalled-agent signal). `approval_flood` triggers when too many approval timeouts accumulate. Each predicate has a consequence: reject, require approval, or flag for review. The pattern is caught without the agent itself needing to recognize it.

---

## 13. Multi-step intent partial failure

**What happens:** An agent declares a sequence of related actions as a single intent: swap A to B, then approve, then stake. The swap succeeds, the approve is rejected. The agent now holds B but no staked position, with no clean continuation path. State is partially committed in a way the policy did not anticipate.

**Root cause:** Treating each action as independent makes the failure surface of a multi-step operation invisible to the policy engine. A policy that approves each step individually has no way to express "all of these steps must succeed together" or "if step 2 fails, do not attempt step 3." Partial commitment is the default behavior of independently-checked actions.

**What simulation catches:** Each step individually, against current state. Not the dependency relationships between steps. Not the state after step 1 has committed when step 2 would actually run. Fork simulation can address the latter when invoked at the intent level.

**What the policy engine can enforce:** `agent.executeIntent()` declares a multi-step operation as a directed acyclic graph with explicit dependencies between steps. A failed step poisons every step that depends on it, so the agent never holds intermediate exposure with no continuation path. Position analysis tracks gross outflow, net change, and intermediate exposure across the whole intent before any signing happens. Fork simulation via Tenderly lets the entire graph be tested against current chain state in a single forked snapshot before commitment. The `IntentPolicy` adds constraints on total spend, max intermediate exposure, max steps, and total duration.

---

## 14. Policy configuration bug

**What happens:** The policy is technically valid but operationally wrong. A cap is set too high. A rolling window is too generous. An approval threshold is below the per-tx cap, making every transaction require approval. A stricter "production" policy is missing a constraint that a more permissive "staging" policy contains. The agent enforces a policy that does what it says, not what was intended.

**Root cause:** Policies are configuration. Configuration errors are silent. Type checks ensure a policy is structurally valid but say nothing about its operational behavior. A bug discovered in production is the worst place to discover it.

**What simulation catches:** Nothing. Simulation tests transactions against the policy, not the policy against itself.

**What the policy engine can enforce:** `@txfence/verify` performs bounded model checking on three properties of any policy before it ships. `absolute_cap_reachability` asks whether N agents executing M transactions could collectively reach the absolute cap. `rolling_window_saturation` asks whether N agents could saturate a rolling window cap through adversarial scheduling. `policy_containment` asks whether every action allowed by an inner policy is also allowed by an outer policy, which is the right way to verify a "production" policy is strictly tighter than a "staging" policy. Each check returns either "holds" with the verified bound or "violated" with a concrete counterexample showing exactly how the property can be broken. The companion `stressTest` function runs six adversarial attack vectors (rapid_fire, coordinated_drain, rpc_failure, stale_simulation, cap_boundary, approval_flood) against the policy and produces a risk report with per-vector failure rates and an actionable recommendation. Both have CLI commands (`txfence verify`, `txfence stress-test`) that exit non-zero on violations and can be wired into CI as gates on every policy change before it ships.

---

*This taxonomy is a living document. It grows as new failure modes are discovered in the field and as txfence users surface edge cases the initial design did not anticipate.*
