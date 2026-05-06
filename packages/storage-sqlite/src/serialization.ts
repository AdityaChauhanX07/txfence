import type { SuccessReceipt, Action, PolicyEvaluation } from '@txfence/core'
import { bigintReplacer, reviveSuccessReceipt } from '@txfence/core'

// Re-export bigintReplacer for use in store.ts
export { bigintReplacer }

export function serializeReceipt(receipt: SuccessReceipt): {
  tx_hash: string
  chain: string
  action: string
  policy_eval: string
  simulation: string
  confirmed_at_block: number
  confirmed_at_ms: number
  gas_used: string
} {
  return {
    tx_hash: receipt.txHash,
    chain: (receipt.action as { chain: string }).chain,
    action: JSON.stringify(receipt.action, bigintReplacer),
    policy_eval: JSON.stringify(receipt.policyEvaluation, bigintReplacer),
    simulation: JSON.stringify(receipt.simulation, bigintReplacer),
    confirmed_at_block: receipt.confirmedAtBlock,
    confirmed_at_ms: receipt.confirmedAtMs,
    gas_used: receipt.gasUsed.toString(),
  }
}

export function deserializeReceipt(row: Record<string, unknown>): SuccessReceipt {
  // SQLite stores JSON as TEXT — parse each column before revival
  const obj: Record<string, unknown> = {
    status: 'success',
    txHash: row['tx_hash'],
    action: typeof row['action'] === 'string' ? JSON.parse(row['action']) : row['action'],
    policyEvaluation: typeof row['policy_eval'] === 'string' ? JSON.parse(row['policy_eval']) : row['policy_eval'],
    simulation: typeof row['simulation'] === 'string' ? JSON.parse(row['simulation']) : row['simulation'],
    confirmedAtBlock: Number(row['confirmed_at_block']),
    confirmedAtMs: Number(row['confirmed_at_ms']),
    gasUsed: row['gas_used'],
  }
  return reviveSuccessReceipt(obj)
}
