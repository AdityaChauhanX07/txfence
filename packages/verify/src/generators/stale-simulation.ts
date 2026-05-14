import type { Policy } from '@txfence/core'
import type { Scenario, ScenarioSeverity } from '../types.js'
import { makeTransfer } from './_helpers.js'

// Stale simulation: tests the simulationStalenessMs check.
// If policy has simulationStalenessMs set, stale simulations should be rejected.

export function generateStaleSimulationScenarios(policy: Policy): Scenario[] {
  const scenarios: Scenario[] = []
  const amount = policy.maxSpendPerTx.amount
  const configuredStaleness = policy.simulationStalenessMs

  // Scenario 1: Stale by 2x the threshold (or inject 100ms if no check configured)
  const s1Staleness =
    configuredStaleness !== undefined ? configuredStaleness * 2 : 100
  const s1Severity: ScenarioSeverity =
    configuredStaleness !== undefined ? 'medium' : 'low'
  scenarios.push({
    id: 'stale_simulation_0',
    vector: 'stale_simulation',
    description:
      configuredStaleness !== undefined
        ? `Simulation is 2x stale (${s1Staleness}ms vs ${configuredStaleness}ms threshold) — should return simulation_stale`
        : `No staleness check configured — injecting 100ms staleness, policy should pass through`,
    transactions: [makeTransfer('agent-0', amount, 0, policy)],
    injectRpcFailure: false,
    simulationStalenessMs: s1Staleness,
    expectedOutcome: 'survived',
    severity: s1Severity,
  })

  // Scenario 2: Simulation just over the threshold
  const s2Staleness = (configuredStaleness ?? 30000) + 1
  scenarios.push({
    id: 'stale_simulation_1',
    vector: 'stale_simulation',
    description:
      `Simulation is just over the threshold (${s2Staleness}ms) — boundary case`,
    transactions: [makeTransfer('agent-0', amount, 0, policy)],
    injectRpcFailure: false,
    simulationStalenessMs: s2Staleness,
    expectedOutcome: 'survived',
    severity: 'medium',
  })

  return scenarios
}
