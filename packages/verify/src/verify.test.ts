import { describe, it, expect } from 'vitest'
import { verify } from './verify.js'
import type { Policy } from '@txfence/core'
import type {
  RollingWindowProperty,
  AbsoluteCapProperty,
  PolicyContainmentProperty,
} from './types.js'

const basePolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 6 },
  allowedContracts: [{ address: '0xUNISWAP', chain: 'ethereum' }],
  requireSimulation: false,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent',
}

describe('absolute_cap_reachability', () => {
  it('holds when agents cannot reach the cap', () => {
    const property: AbsoluteCapProperty = {
      kind: 'absolute_cap_reachability',
      agentCount: 2,
      transactionsPerAgent: 3,
      capAmount: 100_000n,
      token: 'USDC',
      maxSpendPerTx: 1_000n,
    }
    const result = verify(property)
    expect(result.status).toBe('holds')
    if (result.status === 'holds') {
      expect(result.scenariosChecked).toBeGreaterThan(0)
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('finds violation when agents can exceed the cap', () => {
    const property: AbsoluteCapProperty = {
      kind: 'absolute_cap_reachability',
      agentCount: 10,
      transactionsPerAgent: 10,
      capAmount: 50_000n,
      token: 'USDC',
      maxSpendPerTx: 1_000n,
    }
    const result = verify(property)
    expect(result.status).toBe('violated')
    if (result.status === 'violated') {
      expect(result.counterExample.transactions.length).toBeGreaterThan(0)
      expect(result.counterExample.violatedAmount).toBeGreaterThanOrEqual(
        property.capAmount,
      )
      expect(result.counterExample.capLimit).toBe(property.capAmount)
      expect(result.counterExample.description).toContain('USDC')
    }
  })

  it('generates minimal counterexample', () => {
    const property: AbsoluteCapProperty = {
      kind: 'absolute_cap_reachability',
      agentCount: 1,
      transactionsPerAgent: 100,
      capAmount: 5_000n,
      token: 'USDC',
      maxSpendPerTx: 1_000n,
    }
    const result = verify(property)
    expect(result.status).toBe('violated')
    if (result.status === 'violated') {
      expect(result.counterExample.transactions.length).toBeLessThanOrEqual(10)
    }
  })
})

describe('rolling_window_saturation', () => {
  it('holds when agents cannot saturate the window', () => {
    const property: RollingWindowProperty = {
      kind: 'rolling_window_saturation',
      agentCount: 2,
      transactionsPerAgent: 2,
      windowMs: 3_600_000,
      capAmount: 100_000n,
      token: 'USDC',
      maxSpendPerTx: 1_000n,
    }
    const result = verify(property)
    expect(result.status).toBe('holds')
  })

  it('finds violation when burst exceeds window cap', () => {
    const property: RollingWindowProperty = {
      kind: 'rolling_window_saturation',
      agentCount: 10,
      transactionsPerAgent: 10,
      windowMs: 3_600_000,
      capAmount: 5_000n,
      token: 'USDC',
      maxSpendPerTx: 1_000n,
    }
    const result = verify(property)
    expect(result.status).toBe('violated')
    if (result.status === 'violated') {
      expect(result.counterExample.violatedAmount).toBeGreaterThan(
        property.capAmount,
      )
      expect(result.counterExample.transactions.length).toBeGreaterThan(0)
    }
  })

  it('returns correct checkedBound when holds', () => {
    const property: RollingWindowProperty = {
      kind: 'rolling_window_saturation',
      agentCount: 3,
      transactionsPerAgent: 3,
      windowMs: 60_000,
      capAmount: 1_000_000n,
      token: 'USDC',
      maxSpendPerTx: 100n,
    }
    const result = verify(property)
    if (result.status === 'holds') {
      expect(result.checkedBound.agentCount).toBe(3)
      expect(result.checkedBound.transactionsPerAgent).toBe(3)
      expect(result.checkedBound.windowMs).toBe(60_000)
    }
  })
})

describe('policy_containment', () => {
  it('holds when inner policy is strictly contained in outer', () => {
    const innerPolicy: Policy = {
      ...basePolicy,
      maxSpendPerTx: { token: 'USDC', amount: 500n, decimals: 6 },
    }
    const property: PolicyContainmentProperty = {
      kind: 'policy_containment',
      innerPolicy,
      outerPolicy: basePolicy,
    }
    const result = verify(property)
    expect(result.status).toBe('holds')
  })

  it('finds violation when outer is more restrictive than inner', () => {
    const outerPolicy: Policy = {
      ...basePolicy,
      maxSpendPerTx: { token: 'USDC', amount: 500n, decimals: 6 },
    }
    const property: PolicyContainmentProperty = {
      kind: 'policy_containment',
      innerPolicy: basePolicy,
      outerPolicy,
    }
    const result = verify(property)
    expect(result.status).toBe('violated')
    if (result.status === 'violated') {
      expect(result.counterExample.description).toContain('rejected')
      expect(result.counterExample.transactions).toHaveLength(1)
    }
  })

  it('holds for identical policies', () => {
    const property: PolicyContainmentProperty = {
      kind: 'policy_containment',
      innerPolicy: basePolicy,
      outerPolicy: basePolicy,
    }
    const result = verify(property)
    expect(result.status).toBe('holds')
  })
})

describe('verify() dispatch', () => {
  it('returns durationMs for all property types', () => {
    const absProperty: AbsoluteCapProperty = {
      kind: 'absolute_cap_reachability',
      agentCount: 1,
      transactionsPerAgent: 1,
      capAmount: 1_000_000n,
      token: 'USDC',
      maxSpendPerTx: 100n,
    }
    const result = verify(absProperty)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('includes property name in result', () => {
    const absProperty: AbsoluteCapProperty = {
      kind: 'absolute_cap_reachability',
      agentCount: 1,
      transactionsPerAgent: 1,
      capAmount: 1_000_000n,
      token: 'USDC',
      maxSpendPerTx: 100n,
    }
    const result = verify(absProperty)
    expect(result.property).toContain('absolute_cap_reachability')
  })
})
