import type { Policy } from '@txfence/core'
import type { Scenario, TransactionScenario } from '../types.js'
import { makeTransfer } from './_helpers.js'

// Approval flood: many transactions above the approval threshold simultaneously.
// Tests that approval timeout is handled correctly and does not block other agents.

export function generateApprovalFloodScenarios(
  policy: Policy,
  agentCount: number,
): Scenario[] {
  const scenarios: Scenario[] = []

  const threshold = policy.humanApprovalThreshold.amount
  const maxSpend = policy.maxSpendPerTx.amount
  const overThreshold = threshold + 1n
  // Must remain under maxSpendPerTx to isolate the approval-threshold check.
  const aboveThresholdAmount =
    overThreshold > maxSpend ? maxSpend : overThreshold

  // Scenario 1: Single transaction above the approval threshold
  scenarios.push({
    id: 'approval_flood_0',
    vector: 'approval_flood',
    description:
      `Transaction at ${aboveThresholdAmount} (above approval threshold ${threshold}) — ` +
      `should return approval_timeout`,
    transactions: [makeTransfer('agent-0', aboveThresholdAmount, 0, policy)],
    injectRpcFailure: false,
    expectedOutcome: 'survived',
    severity: 'medium',
  })

  // Scenario 2: Multiple agents all submit above-threshold transactions simultaneously
  const s2Tx: TransactionScenario[] = []
  for (let a = 0; a < agentCount; a++) {
    s2Tx.push(makeTransfer(`agent-${a}`, aboveThresholdAmount, 0, policy))
  }
  scenarios.push({
    id: 'approval_flood_1',
    vector: 'approval_flood',
    description:
      `${agentCount} agents each submit an above-threshold transaction at t=0 — ` +
      `approval pipeline must not deadlock`,
    transactions: s2Tx,
    injectRpcFailure: false,
    expectedOutcome: 'survived',
    severity: 'high',
  })

  return scenarios
}
