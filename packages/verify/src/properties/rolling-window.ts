// Rolling window saturation checker.
// Strategy: adversarial scheduling tries to pack as many transactions
// as possible into the window just before it would reset.
// The worst case is all agents submitting simultaneously at t=0,
// then again at t=windowMs-1 (just before reset).

import type {
  RollingWindowProperty,
  VerificationResult,
  CounterExample,
  TransactionScenario,
} from '../types.js'

export function checkRollingWindowSaturation(
  property: RollingWindowProperty,
): VerificationResult {
  const startTime = Date.now()
  const {
    agentCount,
    transactionsPerAgent,
    windowMs,
    capAmount,
    token,
    maxSpendPerTx,
  } = property

  const scenarios = generateRollingWindowScenarios(
    agentCount,
    transactionsPerAgent,
    maxSpendPerTx,
    token,
    windowMs,
  )

  const label =
    `rolling_window_saturation: ${agentCount} agents, ` +
    `${transactionsPerAgent} tx/agent, window=${windowMs}ms, cap=${capAmount} ${token}`

  let scenariosChecked = 0

  for (const scenario of scenarios) {
    scenariosChecked++
    const violation = checkRollingWindowViolation(
      scenario,
      capAmount,
      windowMs,
      transactionsPerAgent,
    )
    if (violation !== null) {
      return {
        status: 'violated',
        property: label,
        counterExample: violation,
        durationMs: Date.now() - startTime,
      }
    }
  }

  return {
    status: 'holds',
    property: label,
    checkedBound: {
      agentCount,
      transactionsPerAgent,
      windowMs,
    },
    scenariosChecked,
    durationMs: Date.now() - startTime,
  }
}

function generateRollingWindowScenarios(
  agentCount: number,
  transactionsPerAgent: number,
  maxSpendPerTx: bigint,
  token: string,
  windowMs: number,
): TransactionScenario[][] {
  const scenarios: TransactionScenario[][] = []

  const buildAction = () =>
    ({
      kind: 'transfer' as const,
      chain: 'ethereum' as const,
      token: { token, amount: maxSpendPerTx, decimals: 6 },
      to: '0x0000000000000000000000000000000000000001',
    })

  // Scenario 1: Simultaneous burst — all agents × all tx at t=0.
  const simultaneous: TransactionScenario[] = []
  for (let a = 0; a < agentCount; a++) {
    for (let t = 0; t < transactionsPerAgent; t++) {
      simultaneous.push({
        agentId: `agent-${a}`,
        action: buildAction(),
        timestamp: 0,
        amount: maxSpendPerTx,
      })
    }
  }
  scenarios.push(simultaneous)

  // Scenario 2: Staggered burst — spread across the window.
  const staggered: TransactionScenario[] = []
  const stride = agentCount > 0 ? Math.floor(windowMs / agentCount) : 0
  for (let a = 0; a < agentCount; a++) {
    const baseTs = a * stride
    for (let t = 0; t < transactionsPerAgent; t++) {
      staggered.push({
        agentId: `agent-${a}`,
        action: buildAction(),
        timestamp: baseTs,
        amount: maxSpendPerTx,
      })
    }
  }
  scenarios.push(staggered)

  // Scenario 3: Double burst — half at t=0, half at t=windowMs-1.
  // Both bursts sit within a single rolling window of length windowMs.
  const half = Math.floor(transactionsPerAgent / 2)
  const remainder = transactionsPerAgent - half
  const doubleBurst: TransactionScenario[] = []
  for (let a = 0; a < agentCount; a++) {
    for (let t = 0; t < half; t++) {
      doubleBurst.push({
        agentId: `agent-${a}`,
        action: buildAction(),
        timestamp: 0,
        amount: maxSpendPerTx,
      })
    }
    for (let t = 0; t < remainder; t++) {
      doubleBurst.push({
        agentId: `agent-${a}`,
        action: buildAction(),
        timestamp: Math.max(0, windowMs - 1),
        amount: maxSpendPerTx,
      })
    }
  }
  scenarios.push(doubleBurst)

  // Scenario 4: Worst-case single agent — all transactions at t=0 by one agent.
  const singleAgent: TransactionScenario[] = []
  const totalForOne = agentCount * transactionsPerAgent
  for (let t = 0; t < totalForOne; t++) {
    singleAgent.push({
      agentId: 'agent-0',
      action: buildAction(),
      timestamp: 0,
      amount: maxSpendPerTx,
    })
  }
  scenarios.push(singleAgent)

  return scenarios
}

function checkRollingWindowViolation(
  transactions: TransactionScenario[],
  capAmount: bigint,
  windowMs: number,
  transactionsPerAgent: number,
): CounterExample | null {
  const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp)

  for (let i = 0; i < sorted.length; i++) {
    const anchor = sorted[i]!
    const lowerBound = anchor.timestamp - windowMs
    let sum = 0n
    for (let j = 0; j <= i; j++) {
      const tx = sorted[j]!
      if (tx.timestamp > lowerBound && tx.timestamp <= anchor.timestamp) {
        sum += tx.amount
      }
    }
    if (sum > capAmount) {
      const agentIds = new Set<string>()
      for (const tx of sorted) agentIds.add(tx.agentId)
      return {
        description:
          'Rolling window cap exceeded by concurrent agent submissions',
        transactions: sorted,
        violatedAt: i,
        violatedAmount: sum,
        capLimit: capAmount,
        checkedBound: {
          agentCount: agentIds.size,
          transactionsPerAgent,
          windowMs,
        },
      }
    }
  }

  return null
}
