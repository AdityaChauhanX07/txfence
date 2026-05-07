# Treasury Agent Example

A complete example of txfence managing a DAO treasury. Demonstrates:
- Policy configuration with spend caps, rolling window, and contract allowlist
- Simulation against Ethereum mainnet via public RPC
- File-based receipt storage and audit logging
- Webhook approval for high-value transactions (dry run)
- On-chain monitoring with checkpoint persistence
- Policy diff before deploying a configuration change

## What this is not

This example does not execute real transactions. It runs the full txfence
pipeline in dry-run mode — every step except signing and broadcasting.
The monitor connects to a real RPC node and scans real blocks.

## Running the example

Prerequisites: Node.js 20+, pnpm

Install dependencies from the repo root:
  pnpm install

Run the main example:
  cd examples/treasury-agent
  npx tsx run.ts

Run the policy diff example:
  npx tsx simulate-policy-change.ts

Run the monitor (connects to Ethereum mainnet):
  npx tsx monitor.ts

## Enabling real execution

To execute real transactions, set these environment variables:
  AGENT_PRIVATE_KEY=0x...    your agent's private key
  ETHEREUM_RPC_URL=https://...  a dedicated RPC endpoint

Then update run.ts to pass a real signer and executor to createAgent.
See the txfence README for the full signing setup.

## Policy overview

The example treasury policy:
- Chains: Ethereum mainnet only
- Max spend per transaction: 10,000 USDC
- Allowed contracts: Uniswap V3 Router, 1inch V5 Router
- Simulation required: yes
- Human approval threshold: 50,000 USDC
- Rolling window: 100,000 USDC per hour
- Absolute cap: 500,000 USDC total
