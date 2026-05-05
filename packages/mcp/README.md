# @txfence/mcp

txfence MCP is a Model Context Protocol server that gives any MCP-compatible AI assistant the ability to simulate, evaluate, and execute on-chain transactions within a declared policy boundary. It wraps the txfence SDK: policy engine, simulation layer, and execution pipeline, exposed as typed tools that any agent can call. The server holds a base policy and an optional signer configured by the team that deploys it. The agent operates within that policy. It can check whether actions are allowed, simulate what would happen, and execute transactions after explicit user confirmation. It cannot modify the policy, bypass the simulation requirement, or execute without a configured signer.

---

## Tools

### `txfence_simulate`

Simulate an action against a chain without executing it. Returns a SimulationResult with the gas estimate, coverage level, and an explicit list of caveats describing what the simulation did and did not cover. Use this when you want to know what would happen before running the full policy pipeline.

Inputs:
- `action` — the action to simulate (swap, transfer, or contract call)
- `chain` — the target chain identifier
- `rpcUrl` — the RPC endpoint to simulate against

Output: SimulationResult with `success`, `gasEstimate`, `coverageLevel`, and `caveats`

---

### `txfence_check_policy`

Evaluate an action against a policy without simulation or execution. Returns a PolicyEvaluation showing every check that was run, whether each passed, and the rejection reason if any failed. Use this for ad-hoc policy questions: would this action be allowed under this policy?

Inputs:
- `action` — the action to evaluate
- `policy` — the full policy to evaluate against (passed explicitly, not from server config)

Output: PolicyEvaluation with `passed`, `checksRun`, and optional `rejectionReason`

---

### `txfence_submit`

Run the full txfence pipeline: policy check, simulation, approval threshold evaluation, and optionally execution. `dryRun` defaults to `true`, which runs every step except signing and broadcasting and returns exactly what would happen. Set `dryRun: false` to execute. Execution requires a signer to be configured server-side, otherwise the tool returns a clear error.

Inputs:
- `action` — the action to submit
- `dryRun` — boolean, defaults to `true`
- `policyOverrides` — optional partial policy object merged on top of the server base policy

Output: ExecutionResult with status `success`, `policy_rejected`, `simulation_failed`, `approval_timeout`, or `execution_failed`

---

### `txfence_get_receipt`

Retrieve on-chain details for a previously submitted transaction by hash. Returns the block number, gas used, and confirmation timestamp. Use this to check the status of a transaction after submission.

Inputs:
- `txHash` — the transaction hash
- `chain` — the chain the transaction was submitted to
- `rpcUrl` — the RPC endpoint to query

Output: transaction status, block number, gas used, confirmation timestamp

---

### `txfence_explain_rejection`

Given a policy rejection reason and the action that was rejected, return a human-readable explanation of why the action failed and what would need to change for it to pass. Use this after a `policy_rejected` result from `txfence_submit` or `txfence_check_policy`.

Inputs:
- `rejectionReason` — the PolicyRejectionReason value from the evaluation
- `action` — the action that was rejected
- `policy` — the policy it was evaluated against

Output: a human-readable string explaining the rejection with specific values

---

## Configuration

The MCP server is configured via a `txfence.config.ts` file in your project root. This file defines the base policy, the chain adapters, the RPC endpoints, and optionally a signer for live execution.

```typescript
import { defineConfig } from '@txfence/mcp'
import { simulateEvmAction, executeEvmAction, privateKeySigner } from '@txfence/evm'

export default defineConfig({
  chains: ['ethereum', 'base'],

  adapters: {
    ethereum: { simulate: simulateEvmAction },
    base:     { simulate: simulateEvmAction },
  },

  rpcUrls: {
    ethereum: 'https://ethereum.publicnode.com',
    base:     'https://base.publicnode.com',
  },

  policy: {
    maxSpendPerTx:          { token: 'USDC', amount: 1000n, decimals: 6 },
    allowedContracts:       [
      { address: '0x1111111254EEB25477B68fb85Ed929f73A960582', chain: 'ethereum' },
    ],
    requireSimulation:      true,
    gasBufferMultiplier:    1.2,
    humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
    humanApprovalTimeoutMs: 30000,
    capLockMode:            'per-agent',
  },

  // optional: required for dryRun: false
  signer: privateKeySigner(process.env.AGENT_PRIVATE_KEY as `0x${string}`),
})
```

The signer is optional. Without it, `txfence_submit` with `dryRun: false` returns a clear error: no signer configured, set dryRun to true or configure a signer in txfence.config.ts. This means you can deploy the MCP server in read-only mode for policy checking and simulation without exposing any signing capability.

Policy overrides passed in `txfence_submit` are shallow-merged on top of the base policy. They can only narrow the policy, not widen it. An override that attempts to increase `maxSpendPerTx` beyond the base policy value is rejected by the server before the pipeline runs.

Never put private keys directly in `txfence.config.ts`. Use `process.env` and a `.env` file excluded from version control. The server will throw at startup if `signer` is configured with an undefined key.

---

## Usage examples

### Scenario 1: dry run then execute

A user asks the assistant to send ETH. The assistant runs a dry run first, shows the user what would happen, and only executes after explicit confirmation.

```
User: Send 0.1 ETH to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

Assistant calls txfence_submit with dryRun: true.

Result: policy passed, simulation succeeded, estimated gas 21000,
coverage partial, caveat: state_may_diverge.

Assistant to user:
"Here is what will happen: 0.1 ETH will be transferred to
0x70997970C51812dc3A010C7d01b50e0d17dc79C8 on Ethereum. Estimated
gas: 21000 units (1.2x buffer applied). The simulation passed but
note that chain state may diverge between now and execution.
Shall I proceed?"

User: Yes go ahead.

Assistant calls txfence_submit with dryRun: false.

Result: { status: 'success', receipt: { txHash: '0xabc...', confirmedAtBlock: 25024100, gasUsed: 21000n } }

Assistant to user:
"Done. Transaction confirmed at block 25024100. Hash: 0xabc..."
```

---

### Scenario 2: policy rejection

A user asks the assistant to send an amount that exceeds the per-transaction cap. The assistant surfaces the rejection clearly.

```
User: Send 5000 USDC to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

Assistant calls txfence_submit with dryRun: true.

Result: { status: 'policy_rejected', evaluation: { passed: false, rejectionReason: 'spend_exceeds_cap' } }

Assistant calls txfence_explain_rejection with reason 'spend_exceeds_cap'.

Result: "spend of 5000 USDC exceeds per-tx cap of 1000 USDC"

Assistant to user:
"This transaction cannot proceed. The requested amount of 5000 USDC
exceeds the per-transaction spending cap of 1000 USDC set in the
server policy. To send 5000 USDC you would need to split it into
multiple transactions of 1000 USDC or less, or have the policy cap
updated by your administrator."
```

---

### Scenario 3: ad-hoc policy check

A user wants to know whether a hypothetical action would be allowed before committing to it.

```
User: Would swapping 800 USDC for ETH via the 1inch router be allowed
      under our current policy?

Assistant calls txfence_check_policy with the swap action and current policy.

Result: {
  passed: true,
  checksRun: ['checkChain', 'checkContract', 'checkSpend', 'checkSlippage']
}

Assistant to user:
"Yes, that swap would be allowed. All policy checks pass: the chain
is permitted, the 1inch router is on the allowlist, 800 USDC is
within the 1000 USDC per-transaction cap, and a slippage tolerance
is declared. Run it as a dry run first if you want to see the
simulation result before executing."
```

---

## Safety model

**Dry run is the default.** `txfence_submit` with no `dryRun` argument behaves as `dryRun: true`. An agent that does not explicitly opt into execution cannot accidentally execute.

**The server holds the guardrails.** The base policy is set by the humans who deploy the server, not by the agent calling the tools. An agent cannot construct a policy that grants itself more permissions than the base policy allows.

**Policy overrides can only narrow.** If the base policy has a `maxSpendPerTx` of 1000 USDC, a `policyOverride` of 2000 USDC is rejected at the server level before the pipeline runs. Overrides exist so an agent can be more conservative than the base policy for a specific call, not more permissive.

**Execution requires a configured signer.** An MCP server with no signer configured is a read-only policy and simulation server. It cannot execute transactions regardless of what the agent requests.

**Cancel on timeout.** If a human approval threshold is exceeded and the approval window expires, the transaction is dropped. Execute on timeout is never the default.

---

## Installation

Add txfence MCP to your MCP client configuration:

```json
{
  "mcpServers": {
    "txfence": {
      "command": "npx",
      "args": ["@txfence/mcp", "--config", "./txfence.config.ts"]
    }
  }
}
```

Then create `txfence.config.ts` in your project root following the configuration section above.

---

## What this document is

This README describes the intended design of `@txfence/mcp` before implementation begins. The tool signatures, configuration shape, and behavior described here are the design specification. Implementation follows from this document, not the other way around.

If you are reading this and the package is not yet published, the core SDK it depends on is available at github.com/AdityaChauhanX07/txfence.
