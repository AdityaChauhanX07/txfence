import type { Action } from '../types/action.js'
import type { Policy } from '../types/policy.js'

export function createTestActions(policy: Policy): Array<{ action: Action }> {
  const actions: Array<{ action: Action }> = []

  for (const chain of policy.chains) {
    actions.push({
      action: {
        kind: 'transfer',
        chain,
        token: {
          token: policy.maxSpendPerTx.token,
          amount: policy.maxSpendPerTx.amount,
          decimals: policy.maxSpendPerTx.decimals,
        },
        to: '0x0000000000000000000000000000000000000001',
      },
    })

    actions.push({
      action: {
        kind: 'transfer',
        chain,
        token: {
          token: policy.maxSpendPerTx.token,
          amount: policy.maxSpendPerTx.amount + 1n,
          decimals: policy.maxSpendPerTx.decimals,
        },
        to: '0x0000000000000000000000000000000000000001',
      },
    })

    for (const entry of policy.allowedContracts.filter(c => c.chain === chain)) {
      actions.push({
        action: {
          kind: 'swap',
          chain,
          from: {
            token: policy.maxSpendPerTx.token,
            amount: policy.maxSpendPerTx.amount / 2n,
            decimals: policy.maxSpendPerTx.decimals,
          },
          to: 'ETH',
          via: entry.address,
          maxSlippage: 50,
        },
      })
    }

    actions.push({
      action: {
        kind: 'swap',
        chain,
        from: {
          token: policy.maxSpendPerTx.token,
          amount: policy.maxSpendPerTx.amount / 2n,
          decimals: policy.maxSpendPerTx.decimals,
        },
        to: 'ETH',
        via: '0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF',
        maxSlippage: 50,
      },
    })

    actions.push({
      action: {
        kind: 'swap',
        chain,
        from: {
          token: policy.maxSpendPerTx.token,
          amount: policy.maxSpendPerTx.amount / 2n,
          decimals: policy.maxSpendPerTx.decimals,
        },
        to: 'ETH',
        via: policy.allowedContracts.find(c => c.chain === chain)?.address
          ?? '0x0000000000000000000000000000000000000002',
        maxSlippage: 0,
      },
    })
  }

  return actions
}
