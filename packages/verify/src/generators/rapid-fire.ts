import type { Policy } from '@txfence/core'
import type { Scenario, TransactionScenario } from '../types.js'
import { makeTransfer } from './_helpers.js'

// Rapid fire: one agent submits many transactions in rapid succession,
// each just under the per-tx cap, all within a tiny time window.
// This tests whether timing races can defeat the cap lock.

export function generateRapidFireScenarios(
  policy: Policy,
  agentCount: number,
  transactionsPerScenario: number,
  timingJitterMs: number,
): Scenario[] {
  const scenarios: Scenario[] = []
  const maxAmount = policy.maxSpendPerTx.amount
  const justUnderCap = maxAmount > 0n ? maxAmount - 1n : 0n

  // Scenario 1: Single agent, max speed (all at t=0)
  const s1Tx: TransactionScenario[] = []
  for (let i = 0; i < transactionsPerScenario; i++) {
    s1Tx.push(makeTransfer('agent-0', justUnderCap, 0, policy))
  }
  scenarios.push({
    id: 'rapid_fire_0',
    vector: 'rapid_fire',
    description:
      `Single agent submits ${transactionsPerScenario} transactions at ` +
      `${justUnderCap} (just under cap) all at t=0`,
    transactions: s1Tx,
    injectRpcFailure: false,
    expectedOutcome: 'survived',
    severity: 'high',
  })

  // Scenario 2: Single agent with timing jitter spread across windowMs
  const s2Tx: TransactionScenario[] = []
  const stride =
    transactionsPerScenario > 0 ? timingJitterMs / transactionsPerScenario : 0
  for (let i = 0; i < transactionsPerScenario; i++) {
    s2Tx.push(
      makeTransfer('agent-0', justUnderCap, Math.floor(i * stride), policy),
    )
  }
  scenarios.push({
    id: 'rapid_fire_1',
    vector: 'rapid_fire',
    description:
      `Single agent submits ${transactionsPerScenario} transactions at ` +
      `${justUnderCap} spread across ${timingJitterMs}ms with timing jitter`,
    transactions: s2Tx,
    injectRpcFailure: false,
    expectedOutcome: 'survived',
    severity: 'high',
  })

  // Scenario 3: Multiple agents each submit 5 transactions simultaneously at t=0
  const s3Tx: TransactionScenario[] = []
  for (let a = 0; a < agentCount; a++) {
    for (let i = 0; i < 5; i++) {
      s3Tx.push(makeTransfer(`agent-${a}`, justUnderCap, 0, policy))
    }
  }
  scenarios.push({
    id: 'rapid_fire_2',
    vector: 'rapid_fire',
    description:
      `${agentCount} agents each submit 5 transactions simultaneously at t=0 ` +
      `at ${justUnderCap} per tx`,
    transactions: s3Tx,
    injectRpcFailure: false,
    expectedOutcome: 'survived',
    severity: 'high',
  })

  return scenarios
}
