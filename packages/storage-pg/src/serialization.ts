import type { SuccessReceipt, Action, PolicyEvaluation } from '@txfence/core'
import {
  bigintReplacer,
  reviveSuccessReceipt,
} from '@txfence/core'

// Re-export bigintReplacer for use in store.ts
export { bigintReplacer }

export function serializeReceipt(receipt: SuccessReceipt): Record<string, unknown> {
  return {
    tx_hash: receipt.txHash,
    chain: (receipt.action as { chain: string }).chain,
    action: JSON.parse(JSON.stringify(receipt.action, bigintReplacer)) as unknown,
    policy_eval: receipt.policyEvaluation,
    simulation: JSON.parse(JSON.stringify(receipt.simulation, bigintReplacer)) as unknown,
    confirmed_at_block: receipt.confirmedAtBlock,
    confirmed_at_ms: receipt.confirmedAtMs,
    gas_used: receipt.gasUsed.toString(),
  }
}

export function deserializeReceipt(row: Record<string, unknown>): SuccessReceipt {
  const obj: Record<string, unknown> = {
    status: 'success',
    txHash: row['tx_hash'],
    action: row['action'],
    policyEvaluation: row['policy_eval'],
    simulation: row['simulation'],
    confirmedAtBlock: Number(row['confirmed_at_block']),
    confirmedAtMs: Number(row['confirmed_at_ms']),
    gasUsed: row['gas_used'],
  }
  return reviveSuccessReceipt(obj)
}
