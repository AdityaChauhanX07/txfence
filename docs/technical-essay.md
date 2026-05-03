# Eight ways autonomous agents lose money on-chain, and what we did about it

## The problem is not what people think it is

When people worry about autonomous agents transacting on-chain, they worry about the wrong things. They worry about private key leaks. They worry about smart contract bugs. They worry about an agent getting hacked.

Those are real risks. They are not the failure mode that is actually killing financial agents in production.

The failure mode that actually happens is quieter. An agent does exactly what it was told to do. It reads the policy correctly. It calls the right contract. It signs a valid transaction. And it still causes loss, because the conditions it was operating in at execution time were not the conditions that existed when its instructions were written.

State moved. A contract was upgraded. Two agents read the same cap simultaneously. A human approval timed out and the system defaulted to execute, because nobody had thought carefully about what the default should be.

These are not security failures. They are policy failures. The agent had no security vulnerability. It had no bugs. It had instructions that were correct in one context and catastrophic in another, and no layer between those instructions and the chain that could tell the difference.

That is the problem txfence is built to solve. Not smarter agents. Not better simulation. A policy engine: a typed, composable layer that sits between what an agent wants to do and what it actually does on-chain, enforcing the rules that make autonomous financial action safe enough to trust.

---

## Why simulation is not safety

Simulation is the first thing teams reach for when they want to make their agent safer. Before the transaction goes out, run it against current chain state. See what would happen. If it looks wrong, abort.

This is better than nothing. It is not safety.

The problem is a timing one. Simulation runs against a snapshot of chain state at a specific block. It tells you what would happen if the chain stayed exactly as it was at that moment. The chain does not stay still. By the time your transaction is broadcast, other transactions have already landed. Liquidity has moved. Prices have shifted. Another agent has withdrawn from the same pool your agent was about to interact with.

On EVM, this window is the length of a block, roughly twelve seconds on Ethereum mainnet. That is enough time for a sandwich bot to see your pending transaction and restructure the state around it. On Solana the window is shorter in absolute terms but the account model creates different divergence patterns: account state can change between simulation and the slot your transaction lands in, and the recent blockhash window adds its own expiry pressure.

The deeper problem is that simulation gives you a binary answer when the honest answer is probabilistic. A simulation that passes is not a guarantee of safe execution. It is evidence that execution would have been safe at a specific moment that has already passed. Most agent frameworks do not communicate this distinction to the builder. They surface a green checkmark and move on.

txfence treats simulation differently. Simulation is a required input to the policy engine, not a replacement for it. Every simulation result in txfence carries a coverage level and an explicit list of caveats: what the simulation covered, what it did not, and which failure modes remain live after simulation passes. A builder calling txfence knows exactly what they are and are not protected against before the transaction is signed.

The policy bounds are what actually protect you. A declared minimum output, a slippage cap, a gas buffer multiplier: these are encoded into the transaction at signing time and enforced by the chain itself at execution time. Simulation tells you what to expect. The policy is what holds if expectations are wrong.

---

## The eight failure modes

The failure taxonomy is published in full at `docs/failure-taxonomy.md`. What follows is the pattern behind each failure mode, not the detail. Read the taxonomy for the full breakdown of root causes, what simulation catches, and what the policy engine can enforce.

**Simulation-execution divergence.** Chain state changes between simulation and execution. The output differs from what simulation predicted. This is not an edge case. It is the default behavior of a live chain under any meaningful load.

**Slippage overrun.** A swap executes at a price significantly worse than intended because no slippage bound was enforced at the signing layer. Most frameworks treat slippage as a UI concern. Autonomous agents have no UI layer. If the bound is not in the transaction, it does not exist.

**Unintended proxy target.** A contract is upgraded between simulation and execution. The agent signed a transaction for one implementation and executed against another. EVM proxy patterns make this structurally possible on any upgradeable contract.

**Spend cap race condition.** Two agents read the same cap, both pass the policy check, both execute. The cap is effectively doubled. Spend caps enforced in application memory are not atomic. In a multi-agent environment this is not a theoretical risk.

**Cross-chain intent replay.** A signed transaction is valid on more than one chain and gets replayed on a chain the agent did not intend. EVM chains share an address space and signing scheme. Missing chain ID scoping in a custom signing flow is enough.

**Approval timeout default.** A human approval window expires. The system defaults to execute because the human did not explicitly say no. In a financial context, the absence of approval is not approval. Execute-on-timeout is the wrong default and it is the default most systems ship with.

**Stale allowlist.** A contract on the allowlist is exploited, deprecated, or transferred after the policy was configured. The policy check passes because the address is still on the list. Allowlists that do not verify current on-chain state are point-in-time snapshots, not ongoing guarantees.

**Gas estimation failure.** A transaction runs out of gas mid-execution, reverts, and the fee is consumed. Gas estimation is a simulation-time calculation. If the execution path diverges from the simulated path, the estimate is wrong.

Every one of these failures has happened to real teams. None of them require a bug in the agent. They require only that the world looked different at execution time than it did when the agent's instructions were written.

---

## Why existing tools don't solve this

The tools that exist today are not bad. They are built for a different problem. Understanding precisely where they stop short is more useful than a general criticism.

**AgentKit** is Coinbase's framework for building on-chain agents. It is well-built and well-documented. It is also built around Coinbase's infrastructure: Coinbase Wallet, Base, and the EVM. If your agent operates on Solana, AgentKit is not an option. If your agent needs to operate without a Coinbase Wallet dependency, AgentKit is not an option. More importantly, AgentKit's safety model lives at the wallet layer: spending limits and contract interactions are controlled through Coinbase's custody infrastructure. That is a valid approach for teams inside that ecosystem. It is not a composable, chain-agnostic policy primitive that a builder can own and reason about independently of their wallet provider.

**GOAT SDK** takes a more open approach. It is plugin-based and more chain-flexible than AgentKit. But its architecture is oriented around connecting agents to actions through a plugin system, not around enforcing typed policies before those actions execute. There is no formal simulation contract. There is no structured receipt. A builder using GOAT gets a flexible action layer. They do not get a policy engine.

**Openfort** is building agent wallet infrastructure with spending limits, contract allowlists, and multi-party approvals. These are the right concepts. But Openfort is an infrastructure product, not an SDK. The policy enforcement lives in Openfort's systems, not in the builder's codebase. A builder using Openfort cannot inspect, extend, or reason about the policy layer the way they can with code they own. They are trusting Openfort's implementation, not composing their own.

The pattern across all three is the same. The safety primitives exist at the infrastructure layer, the wallet layer, or the plugin layer. None of them surface a typed, composable policy engine as a first-class primitive that a builder controls, audits, and extends in their own codebase. That is the gap txfence fills.

---

## The policy engine as the right primitive

The wrong way to think about this problem is as a wallet problem. A smarter wallet with better spending limits does not solve simulation-execution divergence. It does not solve cross-chain intent replay. It does not solve the stale allowlist problem. A wallet controls signing. It does not control the relationship between what an agent intends and what the chain executes.

The wrong way to think about it is also as a simulation problem. Better simulation tooling helps. Tenderly's simulation API is genuinely good. But simulation is a snapshot, and no amount of engineering makes a snapshot into a guarantee. The failure modes that matter most are the ones that occur in the gap between simulation time and execution time.

The right primitive is a policy engine. A layer that sits between the agent's declared intent and the signed transaction, that evaluates every action against a set of typed, auditable rules before a signature is produced, and that makes the coverage and limits of its own protection explicit to the builder.

txfence is built around two design commitments that follow from this.

The first is declarative over intent-based. txfence does not take a natural language intent and figure out what to do with it. It takes an explicitly constructed action with explicitly declared policy bounds. This is less convenient for simple cases. It is the right call for any context where a mistake means real capital at risk. Every action in txfence is inspectable before execution. There is no hidden routing, no inferred slippage tolerance, no assumed chain. The builder declares everything. The policy engine verifies everything.

The second is that the audit trail is first-class, not an afterthought. Every execution in txfence produces a structured receipt: the declared action, the policy evaluation result with every check that was run, the simulation result with its coverage level and caveats, the signed transaction hash, and any human approval events. A risk manager reading a txfence receipt knows exactly what happened, what was checked, and what the system's confidence level was at execution time. This is not a logging feature. It is the thing that makes autonomous financial action auditable enough to trust in an institutional context.

These two commitments make txfence more opinionated than the alternatives. That is intentional. The best developer tools make hard calls. They are polarizing in the right direction: frustrating to users who want magic, and deeply trusted by users who need to understand exactly what their system is doing.

---

## What txfence does and does not protect against

An SDK that oversells its guarantees is more dangerous than no SDK at all. A builder who believes they are protected against a failure mode they are not actually protected against will not build the additional safeguards that failure mode requires. This section is precise about the limits of txfence's protection.

**What txfence fully prevents:**

Slippage overrun, when slippage policy is declared. The bound is structural, not advisory. An agent cannot submit a swap without a declared tolerance and the tolerance is encoded into the transaction at signing time.

Cross-chain intent replay. Chain scoping is enforced at the policy declaration level. An agent cannot sign a transaction for a chain outside its declared chain set and chain ID is verified against the connected provider before every signing operation.

Execute-on-timeout. The cancel-on-timeout default is hard and not configurable in the other direction. A human approval window that expires without a response always results in a dropped transaction, never a silent execution.

**What txfence partially mitigates:**

Simulation-execution divergence. txfence enforces output bounds that limit the damage when divergence occurs. It does not prevent divergence. No tool can prevent divergence. The policy bounds are what hold when the simulation's predictions turn out to be wrong.

Unintended proxy target. txfence supports implementation hash pinning on allowlist entries. When pinning is enabled, txfence checks the current implementation hash before signing and refuses if it does not match. This eliminates the upgrade window risk for contracts where pinning is configured. It does not protect against contracts where pinning is not configured.

Stale allowlist. txfence supports metadata verification on allowlist entries: expected owner address, expected bytecode hash, optional expiry timestamp. This catches ownership transfers, migrations, and self-destructs. It does not catch zero-day exploits against a contract that passes all metadata checks.

Gas estimation failure. txfence enforces a minimum gas buffer multiplier and will not sign a transaction below the buffered estimate. This reduces the frequency of gas estimation failures. It does not eliminate them when execution path divergence is significant enough to exceed even a buffered estimate.

**What txfence does not protect against:**

Spend cap race conditions in multi-agent environments where the cap locking interface is not used. The interface exists. Protection requires the builder to use it.

Any failure mode that occurs after a transaction is confirmed on-chain. txfence operates in the pre-signing and pre-broadcast window. Once a transaction is confirmed, it is outside txfence's scope.

Protocol-level exploits against contracts on the allowlist that pass all metadata checks. txfence verifies that a contract is what it was when it was allowlisted. It cannot verify that the contract's logic is safe.

The honest summary: txfence eliminates the failure modes that come from missing policy enforcement, and bounds the damage from the failure modes that come from chain state divergence. It does not make on-chain action risk-free. It makes the risks explicit, bounded, and auditable.

---

## What we built and what comes next

txfence is not finished. This essay is being published before the implementation is complete because the design decisions matter more than the code, and the design decisions are worth discussing publicly before they are locked in by implementation.

What exists today:

The failure taxonomy is published at `docs/failure-taxonomy.md`. It documents every known failure mode for autonomous agents transacting on-chain, with root causes, honest assessments of what simulation catches, and what the policy engine can enforce. It is a living document.

The core type definitions are published at `packages/core/src/`. Every primitive txfence exposes has a type: `Policy`, `Action`, `SimulationResult`, `ExecutionResult`, `SuccessReceipt`, `PolicyEvaluation`. The full discriminated union of execution outcomes forces builders to handle every result explicitly at compile time. No silent failures.

What is being built next:

The policy engine implementation in `packages/core`. Pure TypeScript, no chain dependencies, fully unit-testable in isolation. Every check documented in the taxonomy implemented as a typed, composable rule.

The EVM chain adapter in `packages/evm`. Simulation via `eth_call` and trace APIs, with explicit coverage semantics. Tenderly integration with documented caveats. Support for Ethereum mainnet, Arbitrum, Optimism, and Base.

The Solana chain adapter in `packages/solana`. `simulateTransaction` with honest account model semantics. Compute budget handling, account locking edge cases, and recent blockhash expiry documented and handled explicitly.

If you are building a financial agent on EVM or Solana and you have hit any of the failure modes in the taxonomy, or you have hit failure modes that are not in it, we want to hear from you. The taxonomy grows through real production experience. Open an issue on GitHub or reach out directly.

The repository is at `github.com/adityachauhanX07/txfence`. The failure taxonomy and type definitions are there now. Everything else is being built in public.
