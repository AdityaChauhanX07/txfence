import { describe, it, expect } from 'vitest'
import { evaluateIntent } from './evaluate.js'
import type { Intent, IntentStep, IntentPolicy } from './types.js'
import type { Policy } from '../types/policy.js'

const txPolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'USDC', amount: 10000n, decimals: 6 },
  allowedContracts: [],
  requireSimulation: false,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 100000n, decimals: 6 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent',
}

const makeStep = (
  id: string,
  amount: bigint,
  dependsOn?: string[],
  optional?: boolean,
): IntentStep => ({
  id,
  action: {
    kind: 'transfer' as const,
    chain: 'ethereum' as const,
    token: { token: 'USDC', amount, decimals: 6 },
    to: '0x0000000000000000000000000000000000000001',
  },
  ...(dependsOn !== undefined ? { dependsOn } : {}),
  ...(optional !== undefined ? { optional } : {}),
})

const makeIntent = (steps: IntentStep[], intentPolicy?: IntentPolicy): Intent => ({
  id: 'test-intent',
  steps,
  ...(intentPolicy !== undefined ? { intentPolicy } : {}),
})

// ── graph validation ──────────────────────────────────────────────────────────

describe('evaluateIntent — graph validation', () => {
  it('rejects cyclic dependency', () => {
    const intent = makeIntent([
      makeStep('A', 1000n, ['B']),
      makeStep('B', 1000n, ['A']),
    ])
    const result = evaluateIntent(intent, txPolicy)
    expect(result.passed).toBe(false)
    expect(result.rejectionReason).toBe('cyclic_dependency')
  })

  it('rejects missing dependency', () => {
    const intent = makeIntent([makeStep('A', 1000n, ['nonexistent'])])
    const result = evaluateIntent(intent, txPolicy)
    expect(result.passed).toBe(false)
    expect(result.rejectionReason).toBe('missing_dependency')
  })
})

// ── intent policy checks ──────────────────────────────────────────────────────

describe('evaluateIntent — intent policy checks', () => {
  it('rejects when too many steps', () => {
    const steps = [makeStep('A', 100n), makeStep('B', 100n), makeStep('C', 100n)]
    const intent = makeIntent(steps, { maxSteps: 2 })
    const result = evaluateIntent(intent, txPolicy)
    expect(result.passed).toBe(false)
    expect(result.rejectionReason).toBe('too_many_steps')
  })

  it('rejects when chain not in allowedChains', () => {
    const steps = [makeStep('A', 1000n)]
    const intent = makeIntent(steps, { allowedChains: ['solana'] })
    const result = evaluateIntent(intent, txPolicy)
    expect(result.passed).toBe(false)
    expect(result.rejectionReason).toBe('chain_not_allowed')
  })

  it('rejects when total gross spend exceeded', () => {
    const steps = [makeStep('A', 6000n), makeStep('B', 6000n)]
    const intent = makeIntent(steps, {
      maxTotalGrossSpend: { token: 'USDC', amount: 10000n, decimals: 6 },
    })
    const result = evaluateIntent(intent, txPolicy)
    expect(result.passed).toBe(false)
    expect(result.rejectionReason).toBe('total_gross_spend_exceeded')
  })

  it('passes when total gross spend within limit', () => {
    const steps = [makeStep('A', 3000n), makeStep('B', 3000n)]
    const intent = makeIntent(steps, {
      maxTotalGrossSpend: { token: 'USDC', amount: 10000n, decimals: 6 },
    })
    const result = evaluateIntent(intent, txPolicy)
    expect(result.passed).toBe(true)
  })

  it('rejects when net spend exceeded', () => {
    const steps = [makeStep('A', 6000n)]
    const intent = makeIntent(steps, {
      maxNetSpend: { token: 'USDC', amount: 5000n, decimals: 6 },
    })
    const result = evaluateIntent(intent, txPolicy)
    expect(result.passed).toBe(false)
    expect(result.rejectionReason).toBe('net_spend_exceeded')
  })

  it('rejects when intermediate exposure exceeded', () => {
    const steps = [makeStep('A', 8000n), makeStep('B', 8000n, ['A'])]
    const intent = makeIntent(steps, {
      maxIntermediateExposure: { token: 'USDC', amount: 5000n, decimals: 6 },
    })
    const result = evaluateIntent(intent, txPolicy)
    expect(result.passed).toBe(false)
    expect(result.rejectionReason).toBe('intermediate_exposure_exceeded')
  })
})

// ── step policy checks ────────────────────────────────────────────────────────

describe('evaluateIntent — step policy checks', () => {
  it('rejects when a required step exceeds per-tx spend cap', () => {
    const steps = [makeStep('A', 50000n)]
    const intent = makeIntent(steps)
    const result = evaluateIntent(intent, txPolicy)
    expect(result.passed).toBe(false)
    expect(result.rejectionReason).toBe('step_policy_rejected')
    expect(result.stepEvaluations[0]?.evaluation.passed).toBe(false)
  })

  it('passes when optional step exceeds per-tx spend cap', () => {
    const steps = [makeStep('A', 50000n, undefined, true)]
    const intent = makeIntent(steps)
    const result = evaluateIntent(intent, txPolicy)
    expect(result.passed).toBe(true)
  })
})

// ── passing intents ───────────────────────────────────────────────────────────

describe('evaluateIntent — passing intents', () => {
  it('passes a simple valid intent with no intent policy', () => {
    const intent = makeIntent([makeStep('A', 1000n), makeStep('B', 1000n, ['A'])])
    const result = evaluateIntent(intent, txPolicy)
    expect(result.passed).toBe(true)
    expect(result.executionPlan).toEqual(['A', 'B'])
    expect(result.stepEvaluations).toHaveLength(2)
  })

  it('returns execution plan in topological order', () => {
    const intent = makeIntent([
      makeStep('C', 500n, ['A', 'B']),
      makeStep('A', 500n),
      makeStep('B', 500n),
    ])
    const result = evaluateIntent(intent, txPolicy)
    expect(result.passed).toBe(true)
    expect(result.executionPlan.indexOf('A')).toBeLessThan(result.executionPlan.indexOf('C'))
    expect(result.executionPlan.indexOf('B')).toBeLessThan(result.executionPlan.indexOf('C'))
  })

  it('includes intentPolicyEvaluation when intentPolicy is set', () => {
    const intent = makeIntent(
      [makeStep('A', 1000n)],
      { maxTotalGrossSpend: { token: 'USDC', amount: 5000n, decimals: 6 } },
    )
    const result = evaluateIntent(intent, txPolicy)
    expect(result.passed).toBe(true)
    expect(result.intentPolicyEvaluation).toBeDefined()
    expect(result.intentPolicyEvaluation?.positionAnalysis).toBeDefined()
  })
})
