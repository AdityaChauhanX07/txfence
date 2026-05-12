import { describe, it, expect } from 'vitest'
import { validateIntentGraph, getPoisonedSteps, checkMaxSteps } from './graph.js'
import type { Intent, IntentStep } from './types.js'

const makeStep = (id: string, dependsOn?: string[], optional?: boolean): IntentStep => ({
  id,
  action: {
    kind: 'transfer' as const,
    chain: 'ethereum' as const,
    token: { token: 'USDC', amount: 1000n, decimals: 6 },
    to: '0x0000000000000000000000000000000000000001',
  },
  ...(dependsOn !== undefined ? { dependsOn } : {}),
  ...(optional !== undefined ? { optional } : {}),
})

const makeIntent = (steps: IntentStep[], maxSteps?: number): Intent => ({
  id: 'test-intent',
  steps,
  ...(maxSteps !== undefined ? { intentPolicy: { maxSteps } } : {}),
})

// ── valid graphs ──────────────────────────────────────────────────────────────

describe('validateIntentGraph — valid graphs', () => {
  it('validates a single step intent', () => {
    const intent = makeIntent([makeStep('step-1')])
    const result = validateIntentGraph(intent)
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.executionPlan).toEqual(['step-1'])
  })

  it('validates a linear chain A → B → C', () => {
    const intent = makeIntent([
      makeStep('A'),
      makeStep('B', ['A']),
      makeStep('C', ['B']),
    ])
    const result = validateIntentGraph(intent)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.executionPlan.indexOf('A')).toBeLessThan(result.executionPlan.indexOf('B'))
      expect(result.executionPlan.indexOf('B')).toBeLessThan(result.executionPlan.indexOf('C'))
    }
  })

  it('validates a diamond dependency (A → B, A → C, B → D, C → D)', () => {
    const intent = makeIntent([
      makeStep('A'),
      makeStep('B', ['A']),
      makeStep('C', ['A']),
      makeStep('D', ['B', 'C']),
    ])
    const result = validateIntentGraph(intent)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.executionPlan.indexOf('A')).toBeLessThan(result.executionPlan.indexOf('D'))
      expect(result.executionPlan.indexOf('B')).toBeLessThan(result.executionPlan.indexOf('D'))
      expect(result.executionPlan.indexOf('C')).toBeLessThan(result.executionPlan.indexOf('D'))
    }
  })

  it('validates parallel steps (no dependencies)', () => {
    const intent = makeIntent([makeStep('A'), makeStep('B'), makeStep('C')])
    const result = validateIntentGraph(intent)
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.executionPlan).toHaveLength(3)
  })
})

// ── invalid graphs ────────────────────────────────────────────────────────────

describe('validateIntentGraph — invalid graphs', () => {
  it('rejects duplicate step IDs', () => {
    const intent = makeIntent([makeStep('A'), makeStep('A')])
    const result = validateIntentGraph(intent)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.detail).toContain('duplicate')
  })

  it('rejects missing dependency', () => {
    const intent = makeIntent([makeStep('A', ['nonexistent'])])
    const result = validateIntentGraph(intent)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('missing_dependency')
  })

  it('rejects self-dependency', () => {
    const intent = makeIntent([makeStep('A', ['A'])])
    const result = validateIntentGraph(intent)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('cyclic_dependency')
  })

  it('rejects a two-step cycle (A → B → A)', () => {
    const intent = makeIntent([makeStep('A', ['B']), makeStep('B', ['A'])])
    const result = validateIntentGraph(intent)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('cyclic_dependency')
  })

  it('rejects a three-step cycle (A → B → C → A)', () => {
    const intent = makeIntent([
      makeStep('A', ['C']),
      makeStep('B', ['A']),
      makeStep('C', ['B']),
    ])
    const result = validateIntentGraph(intent)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('cyclic_dependency')
  })
})

// ── getPoisonedSteps ──────────────────────────────────────────────────────────

describe('getPoisonedSteps', () => {
  it('returns dependents of a failed step', () => {
    const steps = [
      makeStep('A'),
      makeStep('B', ['A']),
      makeStep('C', ['B']),
      makeStep('D'),
    ]
    const poisoned = getPoisonedSteps('A', steps)
    expect(poisoned.has('B')).toBe(true)
    expect(poisoned.has('C')).toBe(true)
    expect(poisoned.has('D')).toBe(false)
    expect(poisoned.has('A')).toBe(false)
  })

  it('returns empty set when step has no dependents', () => {
    const steps = [makeStep('A'), makeStep('B')]
    const poisoned = getPoisonedSteps('B', steps)
    expect(poisoned.size).toBe(0)
  })

  it('handles diamond — both paths are poisoned', () => {
    const steps = [
      makeStep('A'),
      makeStep('B', ['A']),
      makeStep('C', ['A']),
      makeStep('D', ['B', 'C']),
    ]
    const poisoned = getPoisonedSteps('A', steps)
    expect(poisoned.has('B')).toBe(true)
    expect(poisoned.has('C')).toBe(true)
    expect(poisoned.has('D')).toBe(true)
  })
})

// ── checkMaxSteps ─────────────────────────────────────────────────────────────

describe('checkMaxSteps', () => {
  it('returns true when no maxSteps configured', () => {
    expect(checkMaxSteps(makeIntent([makeStep('A'), makeStep('B')]))).toBe(true)
  })

  it('returns true when step count is at the limit', () => {
    expect(checkMaxSteps(makeIntent([makeStep('A'), makeStep('B')], 2))).toBe(true)
  })

  it('returns false when step count exceeds the limit', () => {
    expect(checkMaxSteps(makeIntent([makeStep('A'), makeStep('B'), makeStep('C')], 2))).toBe(false)
  })
})
