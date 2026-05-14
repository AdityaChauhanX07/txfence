import type { Policy } from '@txfence/core'
import type { Scenario } from '../types.js'
import { makeTransfer } from './_helpers.js'

// Cap boundary: off-by-one tests around the spend cap.
// Tests exact cap amount, cap+1n, cap-1n, and zero.

export function generateCapBoundaryScenarios(policy: Policy): Scenario[] {
  const scenarios: Scenario[] = []
  const cap = policy.maxSpendPerTx.amount

  // Scenario 1: Exactly at the cap
  scenarios.push({
    id: 'cap_boundary_0',
    vector: 'cap_boundary',
    description: `Transaction exactly at the cap (${cap}) — must be accepted`,
    transactions: [makeTransfer('agent-0', cap, 0, policy)],
    injectRpcFailure: false,
    expectedOutcome: 'survived',
    severity: 'low',
  })

  // Scenario 2: One unit over the cap
  scenarios.push({
    id: 'cap_boundary_1',
    vector: 'cap_boundary',
    description: `Transaction 1 unit over cap (${cap + 1n}) — must be rejected`,
    transactions: [makeTransfer('agent-0', cap + 1n, 0, policy)],
    injectRpcFailure: false,
    expectedOutcome: 'survived',
    severity: 'high',
  })

  // Scenario 3: One unit under the cap
  const underCap = cap > 0n ? cap - 1n : 0n
  scenarios.push({
    id: 'cap_boundary_2',
    vector: 'cap_boundary',
    description: `Transaction 1 unit under the cap (${underCap}) — must be accepted`,
    transactions: [makeTransfer('agent-0', underCap, 0, policy)],
    injectRpcFailure: false,
    expectedOutcome: 'survived',
    severity: 'low',
  })

  // Scenario 4: Zero amount
  scenarios.push({
    id: 'cap_boundary_3',
    vector: 'cap_boundary',
    description: 'Zero-amount transaction — policy should handle gracefully',
    transactions: [makeTransfer('agent-0', 0n, 0, policy)],
    injectRpcFailure: false,
    expectedOutcome: 'survived',
    severity: 'low',
  })

  return scenarios
}
