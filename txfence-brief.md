# txfence

**A typed, composable policy-and-execution SDK for autonomous agents operating across EVM and Solana — with simulation-before-execution, declarative spending policies, and human-in-the-loop hooks as first-class primitives.**

---

## The Problem

AI agents transacting on-chain fail dangerously. The tools that exist today don't take this seriously enough:

- **AgentKit** (Coinbase) — EVM + Base only, requires Coinbase Wallet infrastructure, conservative design decisions driven by enterprise roadmap pressure. Cannot go deep on Solana.
- **GOAT SDK** — plugin-based, EVM-centric, no typed policy primitives, no formally specified simulation contract.
- **Openfort** — wallet infrastructure with spending limits. Not an SDK for building agent logic.

The safety layer — a programmable policy engine that sits between an agent's intent and on-chain execution — does not exist as a serious, composable, type-safe primitive. Every team building a financial agent is hacking this together themselves, one near-miss at a time.

---

## What txfence Is

txfence is the fence between what an agent *wants to do* and what it *actually does on-chain*.

It is not a wallet. It is not an abstraction over RPC endpoints. It is the execution policy layer — the thing that ensures an agent can only do what it was explicitly permitted to do, with full simulation coverage, a structured audit trail, and optional human approval before irreversible action.

---

## Core Architecture

The execution pipeline every agent action flows through:

```
Agent declares action
  → Policy Engine     evaluate: allowed contract? within spend cap? chain in scope?
  → Simulation        formally scoped guarantee — not a black box
  → Human hook        optional async approval above threshold
  → Sign + broadcast
  → Structured receipt  immutable, typed audit trail
```

### Components

**Policy Engine**
The core primitive. Declarative, typed configuration that enforces constraints before any transaction is built. Policies are not runtime checks bolted on — they are the first-class gate every action passes through.

**Simulation Contract**
Formally specifies what simulation covers and what it does not. This is the part nobody else has gotten right. A `requireSimulation: true` flag that doesn't tell you its false-negative rate is worse than no simulation — it creates false confidence. txfence ships with documented coverage semantics for both EVM and Solana.

**Human-in-the-Loop Hooks**
Async approval above a declared threshold. Designed for treasury management and institutional DeFi contexts where a risk manager needs to stay in the loop without approving every micro-transaction.

**Structured Receipt**
Every execution emits a typed, immutable receipt capturing: the declared action, the policy evaluation result, simulation coverage and caveats, the signed transaction hash, and any human approval events. Designed for audit from day one — not retrofitted later.

---

## API Design Philosophy

txfence follows **Philosophy B: declarative action graph**, not intent-based abstraction.

The deliberate choice: explicit, composable, auditable. No hidden routing. No magic. Every action is inspectable before execution. This is the right design for institutional-grade consumers — the audience that actually needs what txfence provides.

```typescript
const agent = createAgent({
  chains: ['ethereum', 'solana'],
  policies: {
    maxSpendPerTx:          usdc(500),
    allowedContracts:       [UNISWAP_V3, JUPITER_AGG],
    requireSimulation:      true,
    humanApprovalThreshold: usdc(10_000),
  }
})

const result = await agent.submit(
  swap({ from: USDC(100), to: ETH, via: jupiter() })
    .withPolicy({ maxSlippage: bps(50), simulate: true })
)

// result.receipt — typed, immutable, auditable
// result.receipt.policyEvaluation — what was checked, what passed
// result.receipt.simulationCoverage — what the simulation did and did not cover
// result.receipt.txHash — on-chain reference
```

This API surface is a draft, not a commitment. It gets stress-tested against real teams before any implementation begins.

---

## Chain Scope

### v1 — EVM + Solana

**EVM (Ethereum + L2s)**
Simulation via `eth_call` + trace APIs. Tenderly integration with explicit coverage caveats. Known failure modes documented in the failure taxonomy (see below). Supports major L2s: Arbitrum, Optimism, Base.

**Solana**
`simulateTransaction` with honest semantics. Compute budget quirks, account locking edge cases, and recent blockhash expiry documented explicitly. Solana-native DeFi teams are the primary underserved audience — this is where txfence earns its differentiation.

### v2 — Cosmos
Additive. `tx/simulate` with ante handler semantics. Not in scope until EVM + Solana are solid.

Starting narrow is a feature. The well-funded competitors are broad and shallow. txfence is narrow and deep.

---

## Failure Taxonomy

The failure taxonomy is the first design artifact — written before a single line of code. It documents every known way an autonomous agent can lose money or cause harm through on-chain action. It serves two purposes: sharpening the policy engine's design, and positioning txfence publicly as a team that thinks at a different depth.

| Failure Mode | Description |
|---|---|
| Simulation-execution divergence | State changed between simulation and broadcast. Simulation passed; execution failed or produced different output. |
| Slippage overrun | Slippage exceeded declared tolerance but transaction executed anyway due to missing enforcement at the policy layer. |
| Unintended proxy target | Contract upgraded between simulation and execution. Agent interacted with a different implementation than simulated. |
| Spend cap race condition | Multi-agent environment. Two agents simultaneously read the same cap, both pass, both execute — cap effectively doubled. |
| Cross-chain intent replay | Intent signed for one chain, replayed on another. Missing chain ID scoping in the signing flow. |
| Approval timeout default | Human-in-the-loop timeout expired. System defaulted to execute rather than cancel — the dangerous default. |
| Stale allowlist | Contract on the allowlist was deprecated, exploited, or transferred. Allowlist not invalidated. |
| Gas estimation failure | Agent proceeded with an underestimated gas limit. Transaction reverted mid-execution, state partially modified. |

This list is a starting point. It grows through user research with teams actively building financial agents.

---

## Target Audience

txfence is not built for DeFi degens and trading bots. It is built for the teams where a mistake means real institutional capital at risk:

- **Protocol DAOs** managing on-chain treasuries with automated rebalancing agents
- **Institutional DeFi desks** running autonomous liquidity management strategies
- **Structured finance teams** building credit and yield products on-chain (the TrancheLab adjacency)
- **Agent framework builders** who need a safe, typed execution layer beneath their product

The design, documentation tone, error messages, and audit trail are all calibrated for this audience. An institutional risk manager needs to be able to read a txfence receipt and understand exactly what happened and why.

---

## Competitive Position

| | txfence | AgentKit | GOAT SDK | Openfort |
|---|---|---|---|---|
| EVM support | yes | yes | yes | yes |
| Solana support | yes | no | partial | no |
| Typed policy engine | yes | no | no | infra-level only |
| Formal simulation contract | yes | no | no | no |
| Structured audit receipt | yes | no | no | no |
| Human-in-the-loop hooks | yes | partial | no | yes |
| Open source core | yes | yes | yes | no |
| Chain dependency | none | Coinbase Wallet | none | Openfort infra |

The edge is not just feature coverage. It is depth of design — the decisions that well-funded, EVM-moated teams are structurally incapable of shipping because they have roadmaps, investors, and enterprise sales to close. txfence can make hard, opinionated calls they won't make.

---

## Execution Plan

**Step 1 — Write the failure taxonomy**
No code. Every known agent failure mode documented in full. This is the input to every design decision that follows, and the first public artifact that establishes positioning.

**Step 2 — Draft the API in TypeScript types only**
No implementation. Policy declaration surface, action construction, simulation contract shape, receipt type. The Philosophy B commitment made explicit in types before a single function is implemented.

**Step 3 — Write the technical essay**
Explain every major design decision: why a policy engine rather than runtime checks, why declarative over intent-based, what simulation guarantees actually mean and where they break, why the audit trail is first-class. This essay is the distribution artifact. It goes out before the code is ready. It is what gets shared by exactly the teams txfence is built for.

**Step 4 — Build the policy engine + EVM simulation layer**
Core primitives only. Typed, tested, opinionated. The structured receipt is first-class from day one. No shortcuts on the simulation coverage semantics.

**Step 5 — Add Solana support**
`simulateTransaction` layer with formally documented semantics. This is the technical differentiation that no EVM-moated competitor will match.

**Step 6 — Open source and publish**
Public repo. Deep documentation. Technical essay. Failure taxonomy. Outreach to Solana-native DeFi teams and agent framework builders. The GitHub repo is not the launch — the essay and taxonomy are the launch.

### Ongoing throughout — field research with real teams

Reaching out to teams building financial agents on Solana or EVM is not a step with a start and end date — it is a continuous signal channel running in parallel with everything above. Conversations happen on their schedule, not ours. The goal is not to gate building on responses; it is to surface the questions that the design didn't anticipate and fold those into the work as they arrive. The TrancheLab background and structured finance context is the entry point — it opens doors that a generic crypto dev building an SDK cannot.

---

## Known Risks

**Coinbase / Alchemy velocity**
Well-funded teams moving fast into the agentic space. AgentKit now has MCP server mode. The response: go deeper, not broader. Their EVM moat is the reason they can't ship serious Solana support. That gap is durable.

**Simulation semantics complexity**
Simulation across EVM and Solana is harder than it looks. The formal specification of coverage is the moat — don't ship vague guarantees. Honest, precise semantics is the differentiator, not a blocker.

**Maintenance surface**
Solana breaks things constantly. EIP cadence on EVM is relentless. Design for extensibility and clear chain-adapter boundaries from the start. Don't couple core policy logic to chain-specific implementation details.

---

## Positioning Statement

> *The SDK that teams building serious financial agents on EVM and Solana reach for — because it's the only one that treats simulation guarantees, spending policy, and audit trails as first-class primitives, not afterthoughts.*

---

## Stack

- **Core SDK** — TypeScript. The consumer-facing interface. Type safety is the product.
- **Chain adapters** — Rust for Solana-native performance. TypeScript bindings exposed to consumers.
- **Simulation layer** — Chain-specific, with a unified coverage interface above it.
- **Policy engine** — Pure TypeScript. No chain dependencies. Fully unit-testable in isolation.
- **Receipt storage** — Pluggable. In-memory by default, IPFS / custom adapters for persistence.

---

## Name

**txfence** — `tx` (transaction, universally understood in the blockchain dev space) + `fence` (the boundary a policy engine creates between agent intent and on-chain execution). Short, lowercase, no syllable waste. npm clear as of May 2026.

---

*txfence — the fence between what an agent wants to do and what it does.*
