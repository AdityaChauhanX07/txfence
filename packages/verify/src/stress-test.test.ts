import { describe, it, expect } from 'vitest'
import { stressTest, DEFAULT_VECTORS } from './stress-test.js'
import type { Policy } from '@txfence/core'

const basePolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 6 },
  allowedContracts: [],
  requireSimulation: false,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
  humanApprovalTimeoutMs: 100,
  capLockMode: 'per-agent',
}

describe('stressTest', () => {
  it('returns a RiskReport', async () => {
    const report = await stressTest(basePolicy, {
      agentCount: 2,
      transactionsPerScenario: 3,
      vectors: ['cap_boundary', 'rpc_failure'],
    })
    expect(report.totalScenarios).toBeGreaterThan(0)
    expect(report.survivalRate).toBeGreaterThanOrEqual(0)
    expect(report.survivalRate).toBeLessThanOrEqual(1)
    expect(report.survived + report.failed).toBe(report.totalScenarios)
    expect(report.recommendation).toBeTruthy()
    expect(report.generatedAt).toBeGreaterThan(0)
    expect(report.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('tests all default vectors when none specified', async () => {
    const report = await stressTest(basePolicy, {
      agentCount: 2,
      transactionsPerScenario: 2,
    })
    expect(report.totalScenarios).toBeGreaterThan(5)
    void DEFAULT_VECTORS
  })

  it('respects vectors config', async () => {
    const report = await stressTest(basePolicy, {
      vectors: ['cap_boundary'],
      agentCount: 2,
      transactionsPerScenario: 2,
    })
    const vectors = Object.keys(report.byVector)
    expect(vectors).toContain('cap_boundary')
    expect(vectors).not.toContain('rapid_fire')
  })

  it('generates a recommendation string', async () => {
    const report = await stressTest(basePolicy, {
      agentCount: 2,
      transactionsPerScenario: 2,
      vectors: ['cap_boundary'],
    })
    expect(typeof report.recommendation).toBe('string')
    expect(report.recommendation.length).toBeGreaterThan(0)
  })

  it('handles zero scenarios gracefully', async () => {
    const report = await stressTest(basePolicy, {
      vectors: [],
    })
    expect(report.totalScenarios).toBe(0)
    expect(report.survivalRate).toBe(1)
    expect(report.survived).toBe(0)
    expect(report.failed).toBe(0)
  })

  it('reports byVector stats correctly', async () => {
    const report = await stressTest(basePolicy, {
      vectors: ['cap_boundary', 'rpc_failure'],
      agentCount: 2,
      transactionsPerScenario: 2,
    })
    for (const [, stats] of Object.entries(report.byVector)) {
      expect(stats.total).toBeGreaterThan(0)
      expect(stats.failureRate).toBeGreaterThanOrEqual(0)
      expect(stats.failureRate).toBeLessThanOrEqual(1)
    }
  })

  it('cap_boundary scenarios all survive (policy handles boundaries correctly)', async () => {
    const report = await stressTest(basePolicy, {
      vectors: ['cap_boundary'],
      agentCount: 1,
      transactionsPerScenario: 1,
    })
    const boundaryStats = report.byVector['cap_boundary']
    expect(boundaryStats).toBeDefined()
    expect(report.failed).toBe(0)
  })
})
