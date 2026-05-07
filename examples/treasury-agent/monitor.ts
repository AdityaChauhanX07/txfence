#!/usr/bin/env npx tsx
// Treasury monitor — connects to Ethereum mainnet and watches agent addresses.
// Scans real blocks. Requires a working RPC endpoint.

import { createMonitor, createFileCheckpointStore } from '@txfence/monitor'
import { createFileReceiptStore } from '@txfence/core'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RPC_URL = process.env.ETHEREUM_RPC_URL ?? 'https://ethereum.publicnode.com'
const DATA_DIR = resolve(__dirname, './data')

// The agent address to watch — replace with your real agent address
const AGENT_ADDRESS = process.env.AGENT_ADDRESS ?? '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

const receiptStore = createFileReceiptStore(`${DATA_DIR}/receipts.jsonl`)
const checkpointStore = createFileCheckpointStore(`${DATA_DIR}/monitor-checkpoint.json`)

const monitor = createMonitor({
  chains: ['ethereum'],
  agentAddresses: {
    ethereum: [AGENT_ADDRESS],
  },
  rpcUrls: {
    ethereum: RPC_URL,
  },
  receiptStore,
  checkpointStore,
  pollIntervalMs: 12000,       // one block
  maxBlocksPerPoll: 3,         // conservative for public nodes
  gracePeriodMs: 30000,        // 30 seconds before escalating to critical
  reconcileIntervalMs: 300000, // reconcile every 5 minutes

  onUnrecordedTransaction: (event) => {
    if (event.severity === 'critical') {
      console.error('\n[CRITICAL] Unrecorded transaction detected!')
      console.error(`Chain:    ${event.chain}`)
      console.error(`TxHash:   ${event.txHash}`)
      console.error(`From:     ${event.fromAddress}`)
      console.error(`To:       ${event.toAddress}`)
      console.error(`Value:    ${event.value}`)
      console.error(`Block:    ${event.blockNumber}`)
      console.error('\nThis may indicate a signing key compromise.')
      console.error('Pause the agent and investigate immediately.\n')
    } else {
      console.warn(`[WARNING] Unrecorded transaction ${event.txHash} (within grace period)`)
    }
  },

  onCriticalTransaction: (event) => {
    // In production: page your on-call engineer here
    console.error(`[CRITICAL ESCALATION] ${event.txHash} — initiate incident response`)
  },

  onReorgDetected: (event) => {
    console.warn(`[REORG] Transaction ${event.txHash} was in block ${event.originalBlock}`)
    console.warn('Check if the transaction was re-mined or needs resubmission.')
  },
})

async function main(): Promise<void> {
  console.log('\n=== txfence Treasury Monitor ===\n')
  console.log(`RPC:          ${RPC_URL}`)
  console.log(`Agent:        ${AGENT_ADDRESS}`)
  console.log(`Checkpoint:   ${DATA_DIR}/monitor-checkpoint.json`)
  console.log(`Receipts:     ${DATA_DIR}/receipts.jsonl`)
  console.log('\nStarting monitor... (Ctrl+C to stop)\n')
  console.log('Note: public RPC nodes may rate-limit block scanning.')
  console.log('Set ETHEREUM_RPC_URL to a dedicated endpoint for production use.\n')

  await monitor.start()
}

main().catch(console.error)
