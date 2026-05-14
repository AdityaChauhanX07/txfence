import type { Policy } from '@txfence/core'
import type { Scenario } from '../types.js'
import { makeTransfer } from './_helpers.js'

// RPC failure injection: tests that the pipeline handles RPC errors gracefully.
// The pipeline should return a well-defined ExecutionResult, not throw.

export function generateRpcFailureScenarios(policy: Policy): Scenario[] {
  const scenarios: Scenario[] = []
  const amount = policy.maxSpendPerTx.amount

  // Scenario 1: RPC fails during simulation
  scenarios.push({
    id: 'rpc_failure_0',
    vector: 'rpc_failure',
    description:
      'RPC node fails during simulation — pipeline should return simulation_failed',
    transactions: [makeTransfer('agent-0', amount, 0, policy)],
    injectRpcFailure: true,
    rpcFailureStage: 'simulation',
    expectedOutcome: 'survived',
    severity: 'medium',
  })

  // Scenario 2: RPC fails during execution
  scenarios.push({
    id: 'rpc_failure_1',
    vector: 'rpc_failure',
    description:
      'RPC node fails during execution — pipeline should return execution_failed',
    transactions: [makeTransfer('agent-0', amount, 0, policy)],
    injectRpcFailure: true,
    rpcFailureStage: 'execution',
    expectedOutcome: 'survived',
    severity: 'medium',
  })

  // Scenario 3: Intermittent RPC failure across 3 transactions (fails on the second)
  scenarios.push({
    id: 'rpc_failure_2',
    vector: 'rpc_failure',
    description:
      'Intermittent RPC failure across 3 transactions — fails on the second, ' +
      'subsequent transactions should still proceed',
    transactions: [
      makeTransfer('agent-0', amount, 0, policy),
      makeTransfer('agent-0', amount, 10, policy),
      makeTransfer('agent-0', amount, 20, policy),
    ],
    injectRpcFailure: true,
    rpcFailureStage: 'simulation',
    expectedOutcome: 'survived',
    severity: 'low',
  })

  return scenarios
}
