import type { Action, PolicyEvaluation, SuccessReceipt } from '@txfence/core'

export function bigintReplacer(_: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v
}

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
    policy_eval: JSON.stringify(receipt.policyEvaluation),
    simulation: JSON.stringify(receipt.simulation, bigintReplacer),
    confirmed_at_block: receipt.confirmedAtBlock,
    confirmed_at_ms: receipt.confirmedAtMs,
    gas_used: receipt.gasUsed.toString(),
  }
}

export function deserializeReceipt(row: Record<string, unknown>): SuccessReceipt {
  // SQLite stores JSON as TEXT — parse each column back to an object
  const sim = JSON.parse(row['simulation'] as string) as Record<string, unknown>
  sim['gasEstimate'] = BigInt(sim['gasEstimate'] as string)

  const action = JSON.parse(row['action'] as string) as Record<string, unknown>
  if (action['kind'] === 'transfer') {
    const token = action['token'] as Record<string, unknown>
    token['amount'] = BigInt(token['amount'] as string)
  }
  if (action['kind'] === 'swap') {
    const from = action['from'] as Record<string, unknown>
    from['amount'] = BigInt(from['amount'] as string)
  }
  if (action['kind'] === 'contract_call' && action['value'] !== undefined && action['value'] !== null) {
    const value = action['value'] as Record<string, unknown>
    value['amount'] = BigInt(value['amount'] as string)
  }

  const policyEval = JSON.parse(row['policy_eval'] as string) as PolicyEvaluation

  return {
    status: 'success',
    txHash: row['tx_hash'] as string,
    action: action as unknown as Action,
    policyEvaluation: policyEval,
    simulation: sim as unknown as SuccessReceipt['simulation'],
    confirmedAtBlock: Number(row['confirmed_at_block']),
    confirmedAtMs: Number(row['confirmed_at_ms']),
    gasUsed: BigInt(row['gas_used'] as string),
  }
}
