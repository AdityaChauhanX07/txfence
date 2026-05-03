# txfence failure taxonomy

This document catalogs every known failure mode for autonomous agents executing transactions on-chain. It is a design input for txfence — every policy primitive, simulation contract, and safety guarantee in the SDK traces back to at least one entry here. It is also a reference for builders using txfence, so they understand precisely what the SDK protects against and where the boundaries of that protection are. No SDK eliminates all risk. This document is honest about that.

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

*This taxonomy is a living document. It grows as new failure modes are discovered in the field and as txfence users surface edge cases the initial design did not anticipate.*
