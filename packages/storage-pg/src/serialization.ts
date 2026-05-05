import type { Action, PolicyEvaluation, SuccessReceipt } from '@txfence/core'

function bigintReplacer(_: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v
}

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
  const sim = row['simulation'] as Record<string, unknown>
  sim['gasEstimate'] = BigInt(sim['gasEstimate'] as string)

  const action = row['action'] as Record<string, unknown>
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

  return {
    status: 'success',
    txHash: row['tx_hash'] as string,
    action: action as unknown as Action,
    policyEvaluation: row['policy_eval'] as PolicyEvaluation,
    simulation: sim as unknown as SuccessReceipt['simulation'],
    confirmedAtBlock: Number(row['confirmed_at_block']),
    confirmedAtMs: Number(row['confirmed_at_ms']),
    gasUsed: BigInt(row['gas_used'] as string),
  }
}
