import type { Policy } from '@txfence/core'
import type { Scenario, TransactionScenario } from '../types.js'
import { makeTransfer } from './_helpers.js'

// Coordinated drain: multiple agents coordinate to drain a shared cap
// by acquiring locks simultaneously, each taking just under the per-tx cap.
// Tests whether the two-phase cap lock prevents collective over-spend.

export function generateCoordinatedDrainScenarios(
  policy: Policy,
  agentCount: number,
): Scenario[] {
  const scenarios: Scenario[] = []
  const maxAmount = policy.maxSpendPerTx.amount

  // Scenario 1: All agents simultaneous at t=0
  const s1Tx: TransactionScenario[] = []
  for (let a = 0; a < agentCount; a++) {
    s1Tx.push(makeTransfer(`agent-${a}`, maxAmount, 0, policy))
  }
  scenarios.push({
    id: 'coordinated_drain_0',
    vector: 'coordinated_drain',
    description:
      `${agentCount} agents simultaneously submit max-spend transactions at t=0 ` +
      `(total ${BigInt(agentCount) * maxAmount} > rolling window)`,
    transactions: s1Tx,
    injectRpcFailure: false,
    expectedOutcome: 'survived',
    severity: 'critical',
  })

  // Scenario 2: Agents stagger by 1ms each, within a 10ms window
  const s2Tx: TransactionScenario[] = []
  for (let a = 0; a < agentCount; a++) {
    s2Tx.push(makeTransfer(`agent-${a}`, maxAmount, a, policy))
  }
  scenarios.push({
    id: 'coordinated_drain_1',
    vector: 'coordinated_drain',
    description:
      `${agentCount} agents stagger max-spend transactions by 1ms each ` +
      `within a 10ms window — tests two-phase cap lock under race conditions`,
    transactions: s2Tx,
    injectRpcFailure: false,
    expectedOutcome: 'survived',
    severity: 'critical',
  })

  // Scenario 3: Two waves — wave 1 = ceil(0.8 * agentCount / 2) agents, wave 2 = rest
  const wave1Count = Math.ceil((0.8 * agentCount) / 2)
  const s3Tx: TransactionScenario[] = []
  for (let a = 0; a < wave1Count; a++) {
    s3Tx.push(makeTransfer(`agent-${a}`, maxAmount, 0, policy))
  }
  for (let a = wave1Count; a < agentCount; a++) {
    s3Tx.push(makeTransfer(`agent-${a}`, maxAmount, 100, policy))
  }
  scenarios.push({
    id: 'coordinated_drain_2',
    vector: 'coordinated_drain',
    description:
      `Two-wave drain: ${wave1Count} agents at t=0, ${agentCount - wave1Count} agents at t=100ms — ` +
      `wave 1 takes ~80% of cap, wave 2 tries to take more`,
    transactions: s3Tx,
    injectRpcFailure: false,
    expectedOutcome: 'survived',
    severity: 'high',
  })

  return scenarios
}
