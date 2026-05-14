import type { ChainId, Policy } from '@txfence/core'
import type { TransactionScenario } from '../types.js'

export function makeTransfer(
  agentId: string,
  amount: bigint,
  timestamp: number,
  policy: Policy,
): TransactionScenario {
  return {
    agentId,
    action: {
      kind: 'transfer' as const,
      chain: policy.chains[0] as ChainId,
      token: {
        token: policy.maxSpendPerTx.token,
        amount,
        decimals: policy.maxSpendPerTx.decimals,
      },
      to: '0x0000000000000000000000000000000000000001',
    },
    timestamp,
    amount,
  }
}
