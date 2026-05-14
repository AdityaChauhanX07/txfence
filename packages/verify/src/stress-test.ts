import type { Policy } from '@txfence/core'
import type { StressTestConfig, RiskReport, AttackVector } from './types.js'
import { generateAllScenarios } from './generators/index.js'
import { executeScenario } from './executor.js'
import { generateRiskReport } from './reporter.js'

export const DEFAULT_VECTORS: AttackVector[] = [
  'rapid_fire',
  'coordinated_drain',
  'rpc_failure',
  'stale_simulation',
  'cap_boundary',
  'approval_flood',
]

export async function stressTest(
  policy: Policy,
  config?: StressTestConfig,
): Promise<RiskReport> {
  const startTime = Date.now()

  const fullConfig: Required<StressTestConfig> = {
    agentCount: config?.agentCount ?? 10,
    transactionsPerScenario: config?.transactionsPerScenario ?? 20,
    timingJitterMs: config?.timingJitterMs ?? 50,
    rpcFailureRate: config?.rpcFailureRate ?? 0.1,
    vectors: config?.vectors ?? DEFAULT_VECTORS,
    seed: config?.seed ?? Date.now(),
    timeoutMs: config?.timeoutMs ?? 5000,
  }

  const scenarios = generateAllScenarios(policy, fullConfig, fullConfig.vectors)

  const results = await Promise.all(
    scenarios.map(scenario =>
      executeScenario(scenario, policy, fullConfig.timeoutMs),
    ),
  )

  const durationMs = Date.now() - startTime
  return generateRiskReport(policy, results, durationMs)
}
