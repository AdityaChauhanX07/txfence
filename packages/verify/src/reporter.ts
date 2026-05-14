// Risk reporter — aggregates ScenarioResults into a RiskReport.
// Computes survival rate, groups failures by vector and severity,
// and generates actionable recommendations based on failure patterns.

import type {
  ScenarioResult,
  RiskReport,
  AttackVector,
  ScenarioSeverity,
  VectorStats,
} from './types.js'
import type { Policy } from '@txfence/core'

export function generateRiskReport(
  policy: Policy,
  results: ScenarioResult[],
  durationMs: number,
): RiskReport {
  const survived = results.filter(r => r.outcome === 'survived').length
  const failed = results.filter(r => r.outcome !== 'survived').length
  const failedScenarios = results.filter(r => r.outcome !== 'survived')
  const survivalRate = results.length === 0 ? 1 : survived / results.length

  const byVector: Partial<Record<AttackVector, VectorStats>> = {}
  for (const result of results) {
    const existing = byVector[result.vector] ?? { total: 0, failed: 0, failureRate: 0 }
    existing.total++
    if (result.outcome !== 'survived') existing.failed++
    existing.failureRate = existing.total > 0 ? existing.failed / existing.total : 0
    byVector[result.vector] = existing
  }

  const bySeverity: Partial<Record<ScenarioSeverity, number>> = {}
  for (const result of failedScenarios) {
    bySeverity[result.severity] = (bySeverity[result.severity] ?? 0) + 1
  }

  const recommendation = generateRecommendation(policy, failedScenarios, byVector)

  return {
    policy,
    totalScenarios: results.length,
    survived,
    failed,
    survivalRate,
    failedScenarios: failedScenarios.sort((a, b) => {
      const order: Record<ScenarioSeverity, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      }
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
    }),
    byVector,
    bySeverity,
    generatedAt: Date.now(),
    durationMs,
    recommendation,
  }
}

function generateRecommendation(
  _policy: Policy,
  failures: ScenarioResult[],
  byVector: Partial<Record<AttackVector, VectorStats>>,
): string {
  if (failures.length === 0) {
    return (
      'All scenarios passed. Your policy appears robust within the tested bounds. ' +
      'Consider increasing agent count and transaction count for deeper coverage.'
    )
  }

  const recommendations: string[] = []

  const rapidFireStats = byVector['rapid_fire']
  if (rapidFireStats !== undefined && rapidFireStats.failed > 0) {
    recommendations.push(
      `Rapid-fire attack vulnerability detected (${rapidFireStats.failed}/${rapidFireStats.total} scenarios failed). ` +
        `Consider adding per-agent transaction rate limiting via the AgentCoordinator, ` +
        `or reducing maxSpendPerTx to limit per-transaction exposure.`,
    )
  }

  const drainStats = byVector['coordinated_drain']
  if (drainStats !== undefined && drainStats.failed > 0) {
    recommendations.push(
      `Coordinated drain vulnerability detected (${drainStats.failed}/${drainStats.total} scenarios failed). ` +
        `Your rolling window cap or absolute cap may be insufficient for the configured agent count. ` +
        `Consider reducing maxSpendPerTx, adding a tighter rolling window, or using Redis cap locking ` +
        `for atomic cross-agent cap enforcement.`,
    )
  }

  const rpcStats = byVector['rpc_failure']
  if (rpcStats !== undefined && rpcStats.failed > 0) {
    recommendations.push(
      `RPC failure handling issues detected (${rpcStats.failed}/${rpcStats.total} scenarios failed). ` +
        `Wrap your chain adapter with createCircuitBreaker() to prevent cascade failures ` +
        `when the RPC node becomes unavailable.`,
    )
  }

  const staleStats = byVector['stale_simulation']
  if (staleStats !== undefined && staleStats.failed > 0) {
    recommendations.push(
      `Stale simulation vulnerability detected. ` +
        `Set simulationStalenessMs in your policy (recommended: 15000-30000ms for DeFi actions) ` +
        `to abort execution when too much time passes between simulation and signing.`,
    )
  }

  const boundaryStats = byVector['cap_boundary']
  if (boundaryStats !== undefined && boundaryStats.failed > 0) {
    recommendations.push(
      `Cap boundary handling issues detected (${boundaryStats.failed}/${boundaryStats.total} scenarios failed). ` +
        `Review the spend cap comparison logic — boundary conditions around maxSpendPerTx ` +
        `are not handled correctly.`,
    )
  }

  const systemErrors = failures.filter(f => f.outcome === 'system_error')
  if (systemErrors.length > 0) {
    recommendations.push(
      `${systemErrors.length} scenario(s) caused unhandled exceptions. ` +
        `These are the highest priority to fix — unhandled exceptions in a financial pipeline ` +
        `can lead to partial state (cap locks acquired but not released, receipts not recorded). ` +
        `Review the error details for each failed scenario.`,
    )
  }

  return (
    recommendations.join('\n\n') ||
    `${failures.length} scenario(s) failed. Review the counterexamples above for details.`
  )
}
