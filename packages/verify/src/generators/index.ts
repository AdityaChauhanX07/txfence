import type { Policy } from '@txfence/core'
import type {
  AttackVector,
  Scenario,
  StressTestConfig,
} from '../types.js'
import { generateRapidFireScenarios } from './rapid-fire.js'
import { generateCoordinatedDrainScenarios } from './coordinated-drain.js'
import { generateRpcFailureScenarios } from './rpc-failure.js'
import { generateStaleSimulationScenarios } from './stale-simulation.js'
import { generateCapBoundaryScenarios } from './cap-boundary.js'
import { generateApprovalFloodScenarios } from './approval-flood.js'

export {
  generateRapidFireScenarios,
  generateCoordinatedDrainScenarios,
  generateRpcFailureScenarios,
  generateStaleSimulationScenarios,
  generateCapBoundaryScenarios,
  generateApprovalFloodScenarios,
}

export function generateAllScenarios(
  policy: Policy,
  config: Required<StressTestConfig>,
  vectors: AttackVector[],
): Scenario[] {
  const scenarios: Scenario[] = []
  for (const vector of vectors) {
    switch (vector) {
      case 'rapid_fire':
        scenarios.push(
          ...generateRapidFireScenarios(
            policy,
            config.agentCount,
            config.transactionsPerScenario,
            config.timingJitterMs,
          ),
        )
        break
      case 'coordinated_drain':
        scenarios.push(
          ...generateCoordinatedDrainScenarios(policy, config.agentCount),
        )
        break
      case 'rpc_failure':
        scenarios.push(...generateRpcFailureScenarios(policy))
        break
      case 'stale_simulation':
        scenarios.push(...generateStaleSimulationScenarios(policy))
        break
      case 'cap_boundary':
        scenarios.push(...generateCapBoundaryScenarios(policy))
        break
      case 'approval_flood':
        scenarios.push(
          ...generateApprovalFloodScenarios(policy, config.agentCount),
        )
        break
      case 'chain_reorg':
        // chain_reorg scenarios test the monitor, not the pipeline —
        // deferred to a future revision.
        break
    }
  }
  return scenarios
}
