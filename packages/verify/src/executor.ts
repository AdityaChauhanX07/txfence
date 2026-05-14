// Scenario executor — runs adversarial scenarios through a mock pipeline.
// Uses real runPipeline with injected mock adapters and cap providers.
// No real RPC calls. No real signing. No real broadcasting.
// The executor tests the policy engine, cap locking, and approval handling
// under adversarial conditions.

import type { Scenario, ScenarioResult } from './types.js'
import type { Policy, SimulationResult, ChainId } from '@txfence/core'
import { runPipeline } from '@txfence/core'

export async function executeScenario(
  scenario: Scenario,
  policy: Policy,
  timeoutMs: number,
): Promise<ScenarioResult> {
  const startTime = Date.now()

  try {
    const resultPromise = runScenarioUnsafe(scenario, policy)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs),
    )

    await Promise.race([resultPromise, timeoutPromise])

    const durationMs = Date.now() - startTime
    return {
      scenarioId: scenario.id,
      vector: scenario.vector,
      description: scenario.description,
      outcome: 'survived',
      durationMs,
      details: 'All pipeline calls returned well-defined results',
      severity: scenario.severity,
    }
  } catch (err) {
    const durationMs = Date.now() - startTime
    const message = (err as Error).message

    if (message === 'timeout') {
      return {
        scenarioId: scenario.id,
        vector: scenario.vector,
        description: scenario.description,
        outcome: 'timeout',
        durationMs,
        details: `Scenario exceeded ${timeoutMs}ms timeout`,
        severity: 'critical',
      }
    }

    return {
      scenarioId: scenario.id,
      vector: scenario.vector,
      description: scenario.description,
      outcome: 'system_error',
      durationMs,
      details: `Unhandled error: ${message}`,
      severity: 'critical',
    }
  }
}

async function runScenarioUnsafe(
  scenario: Scenario,
  policy: Policy,
): Promise<void> {
  const passingSim: SimulationResult = {
    success: true,
    wouldRevert: false,
    chain: (policy.chains[0] ?? 'ethereum') as ChainId,
    simulatedAtBlock: 1000,
    gasEstimate: 21000n,
    gasBufferApplied: policy.gasBufferMultiplier,
    coverageLevel: 'basic',
    caveats: ['state_may_diverge'],
    provider: 'eth_call',
  }

  const failingSim: SimulationResult = {
    ...passingSim,
    success: false,
    wouldRevert: true,
    revertReason: 'injected RPC failure',
    coverageLevel: 'none',
  }

  const mockAdapter = {
    simulate:
      scenario.injectRpcFailure && scenario.rpcFailureStage === 'simulation'
        ? async (): Promise<SimulationResult> => failingSim
        : async (): Promise<SimulationResult> => passingSim,
  }

  const mockExecutor =
    scenario.injectRpcFailure && scenario.rpcFailureStage === 'execution'
      ? async (): Promise<never> => {
          throw new Error('injected RPC failure at execution')
        }
      : undefined

  const rpcUrl = `http://mock-rpc-${scenario.id}`

  const testPolicy: Policy =
    scenario.simulationStalenessMs !== undefined
      ? { ...policy, simulationStalenessMs: 1 }
      : policy

  for (const tx of scenario.transactions) {
    const adapters = { [tx.action.chain]: mockAdapter } as Parameters<typeof runPipeline>[2]
    const rpcUrls = { [tx.action.chain]: rpcUrl } as Parameters<typeof runPipeline>[3]

    if (scenario.simulationStalenessMs !== undefined) {
      await new Promise(resolve => setTimeout(resolve, 2))
    }

    const result = await runPipeline(
      tx.action,
      testPolicy,
      adapters,
      rpcUrls,
      mockExecutor,
    )

    void result
  }
}
