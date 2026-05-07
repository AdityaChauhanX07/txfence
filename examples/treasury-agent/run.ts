#!/usr/bin/env npx tsx
// Treasury agent example — dry run mode
// Demonstrates the full txfence pipeline without executing real transactions.
// Set AGENT_PRIVATE_KEY and ETHEREUM_RPC_URL to enable real execution.

import {
  createAgent,
  createMemoryCapLockProvider,
  createMemoryApprovalProvider,
  createFileReceiptStore,
} from '@txfence/core'
import type { TransferAction, SwapAction } from '@txfence/core'
import { simulateEvmAction } from '@txfence/evm'
import { createFileAuditLog } from '@txfence/audit'
import { treasuryPolicy, treasuryCapConfig, UNISWAP_V3_ROUTER } from './policy.js'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RPC_URL = process.env.ETHEREUM_RPC_URL ?? 'https://ethereum.publicnode.com'
const DATA_DIR = resolve(__dirname, './data')

// Storage
const receiptStore = createFileReceiptStore(`${DATA_DIR}/receipts.jsonl`)
const auditLog = createFileAuditLog(`${DATA_DIR}/audit.jsonl`)

// Cap locking — in-memory for this example
// In production: use createRedisCapLockProvider for multi-agent environments
const capLockProvider = createMemoryCapLockProvider(treasuryCapConfig, {
  onCapWarning: (event) => {
    console.warn(
      `[CAP WARNING] ${event.capId} ${event.type}: ` +
      `${event.pctUsed}% of ${event.capAmount} ${event.token} consumed`,
    )
  },
})

// Approval provider — memory for this example
// In production: use createWebhookApprovalProvider
const approvalProvider = createMemoryApprovalProvider()

// Create the agent
const agent = createAgent(
  {
    chains: ['ethereum'],
    policies: treasuryPolicy,
    signer: {
      // Placeholder signer — replace with privateKeySigner for real execution
      address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      sign: async () => { throw new Error('signing not configured — set AGENT_PRIVATE_KEY') },
    },
  },
  { ethereum: { simulate: simulateEvmAction } },
  { ethereum: RPC_URL },
  undefined,           // no executor — dry run
  capLockProvider,
  undefined,           // no metadata verifier
  approvalProvider,
  receiptStore,
  auditLog,
)

async function runExample(): Promise<void> {
  console.log('\n=== txfence Treasury Agent Example ===\n')
  console.log(`RPC: ${RPC_URL}`)
  console.log(`Data: ${DATA_DIR}`)
  console.log('\nRunning in dry-run mode. Set AGENT_PRIVATE_KEY to enable real execution.\n')

  // Example 1: Small USDC transfer — should pass all checks
  console.log('--- Example 1: Small transfer (should pass policy) ---')
  const smallTransfer: TransferAction = {
    kind: 'transfer',
    chain: 'ethereum',
    token: { token: 'USDC', amount: 1_000_000_000n, decimals: 6 }, // 1,000 USDC
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  }

  const result1 = await agent.submit({ action: smallTransfer, policy: treasuryPolicy })
  console.log(`Status: ${result1.status}`)
  if (result1.status === 'policy_rejected') {
    console.log(`Rejected: ${result1.evaluation.rejectionReason}`)
  } else if (result1.status === 'execution_failed') {
    console.log(`Reached execution step (dry run): ${result1.reason}`)
  } else if (result1.status === 'simulation_failed') {
    console.log(`Simulation failed — check RPC connectivity`)
  }

  // Example 2: Transfer over per-tx cap — should be rejected
  console.log('\n--- Example 2: Large transfer (should exceed per-tx cap) ---')
  const largeTransfer: TransferAction = {
    kind: 'transfer',
    chain: 'ethereum',
    token: { token: 'USDC', amount: 20_000_000_000n, decimals: 6 }, // 20,000 USDC
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  }

  const result2 = await agent.submit({ action: largeTransfer, policy: treasuryPolicy })
  console.log(`Status: ${result2.status}`)
  if (result2.status === 'policy_rejected') {
    console.log(`Rejected: ${result2.evaluation.rejectionReason}`)
  }

  // Example 3: Swap via Uniswap V3 — allowed contract
  console.log('\n--- Example 3: Swap via Uniswap V3 (allowed contract) ---')
  const uniswapSwap: SwapAction = {
    kind: 'swap',
    chain: 'ethereum',
    from: { token: 'USDC', amount: 5_000_000_000n, decimals: 6 }, // 5,000 USDC
    to: 'ETH',
    via: UNISWAP_V3_ROUTER,
    maxSlippage: 50, // 0.5%
  }

  const result3 = await agent.submit({ action: uniswapSwap, policy: treasuryPolicy })
  console.log(`Status: ${result3.status}`)
  if (result3.status === 'policy_rejected') {
    console.log(`Rejected: ${result3.evaluation.rejectionReason}`)
  } else if (result3.status === 'execution_failed') {
    console.log(`Reached execution step (dry run): ${result3.reason}`)
  } else if (result3.status === 'simulation_failed') {
    console.log(`Simulation failed: coverage=${result3.simulation.coverageLevel}`)
  }

  // Example 4: Swap via unlisted contract — should be rejected
  console.log('\n--- Example 4: Swap via unlisted contract (should be rejected) ---')
  const unlistedSwap: SwapAction = {
    kind: 'swap',
    chain: 'ethereum',
    from: { token: 'USDC', amount: 1_000_000_000n, decimals: 6 },
    to: 'ETH',
    via: '0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF',
    maxSlippage: 50,
  }

  const result4 = await agent.submit({ action: unlistedSwap, policy: treasuryPolicy })
  console.log(`Status: ${result4.status}`)
  if (result4.status === 'policy_rejected') {
    console.log(`Rejected: ${result4.evaluation.rejectionReason}`)
  }

  // Example 5: Check approval threshold — short timeout so demo doesn't block
  console.log('\n--- Example 5: High-value transfer (triggers approval timeout) ---')
  const highValueTransfer: TransferAction = {
    kind: 'transfer',
    chain: 'ethereum',
    token: { token: 'USDC', amount: 60_000_000_000n, decimals: 6 }, // 60,000 USDC
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  }

  // Raise per-tx cap and shorten approval window so the demo doesn't wait 60 s
  const highCapPolicy = {
    ...treasuryPolicy,
    maxSpendPerTx: { token: 'USDC', amount: 100_000_000_000n, decimals: 6 },
    humanApprovalTimeoutMs: 200,
  }

  const result5 = await agent.submit({ action: highValueTransfer, policy: highCapPolicy })
  console.log(`Status: ${result5.status}`)
  if (result5.status === 'approval_timeout') {
    console.log('Approval timed out (no approver configured in dry-run mode)')
  }

  // Summary
  console.log('\n=== Summary ===')
  console.log(`Receipts stored: ${DATA_DIR}/receipts.jsonl`)
  console.log(`Audit log:       ${DATA_DIR}/audit.jsonl`)

  const allEntries = await auditLog.query()
  console.log(`Total decisions recorded: ${allEntries.length}`)
  const byStatus = allEntries.reduce((acc, e) => {
    const s = e.outcome.status
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`)
  })
}

runExample().catch(console.error)
