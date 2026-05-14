import type {
  AbsoluteCapProperty,
  TransactionScenario,
  VerificationResult,
} from '../types.js'

export function checkAbsoluteCapReachability(
  property: AbsoluteCapProperty,
): VerificationResult {
  const startTime = Date.now()
  const { agentCount, transactionsPerAgent, capAmount, token, maxSpendPerTx } =
    property

  const totalTransactions = BigInt(agentCount * transactionsPerAgent)
  const maxPossibleSpend = totalTransactions * maxSpendPerTx

  const checkedBound = { agentCount, transactionsPerAgent }
  const label =
    `absolute_cap_reachability: ${agentCount} agents × ` +
    `${transactionsPerAgent} tx = max ${maxPossibleSpend} ${token}, cap=${capAmount}`

  if (maxPossibleSpend >= capAmount) {
    const transactionsNeeded = capAmount / maxSpendPerTx + 1n

    const counterTransactions: TransactionScenario[] = []
    let remaining = transactionsNeeded
    let agentIdx = 0

    while (remaining > 0n && agentIdx < agentCount) {
      const txForThisAgent =
        remaining < BigInt(transactionsPerAgent)
          ? remaining
          : BigInt(transactionsPerAgent)

      for (let t = 0n; t < txForThisAgent; t++) {
        counterTransactions.push({
          agentId: `agent-${agentIdx}`,
          action: {
            kind: 'transfer' as const,
            chain: 'ethereum' as const,
            token: { token, amount: maxSpendPerTx, decimals: 6 },
            to: '0x0000000000000000000000000000000000000001',
          },
          timestamp: Number(t) * 1000,
          amount: maxSpendPerTx,
        })
      }
      remaining -= txForThisAgent
      agentIdx++
    }

    const violatedAmount = counterTransactions.reduce(
      (sum, t) => sum + t.amount,
      0n,
    )

    return {
      status: 'violated',
      property: label,
      counterExample: {
        description:
          `${agentCount} agents × ${transactionsPerAgent} transactions at ` +
          `${maxSpendPerTx} ${token} each can collectively reach ${maxPossibleSpend} ${token}, ` +
          `exceeding the absolute cap of ${capAmount} ${token}. ` +
          `Only ${transactionsNeeded} transactions needed to violate.`,
        transactions: counterTransactions,
        violatedAt: counterTransactions.length - 1,
        violatedAmount,
        capLimit: capAmount,
        checkedBound,
      },
      durationMs: Date.now() - startTime,
    }
  }

  return {
    status: 'holds',
    property: label,
    checkedBound,
    scenariosChecked: 1,
    durationMs: Date.now() - startTime,
  }
}
