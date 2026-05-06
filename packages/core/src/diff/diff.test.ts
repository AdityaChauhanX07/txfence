import { describe, it, expect } from 'vitest'
import { diffPolicies } from './diff.js'
import { createTestActions } from './helpers.js'
import type { Policy, TransferAction, SwapAction } from '@txfence/core'

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

const stricterPolicy: Policy = {
  ...basePolicy,
  maxSpendPerTx: { token: 'USDC', amount: 500n, decimals: 6 },
}

const looserPolicy: Policy = {
  ...basePolicy,
  maxSpendPerTx: { token: 'USDC', amount: 2000n, decimals: 6 },
}

const differentAllowlistPolicy: Policy = {
  ...basePolicy,
  allowedContracts: [{ address: '0xCURVE', chain: 'ethereum' }],
}

const smallTransfer: TransferAction = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'USDC', amount: 400n, decimals: 6 },
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}

const largeTransfer: TransferAction = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'USDC', amount: 800n, decimals: 6 },
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}

const uniswapSwap: SwapAction = {
  kind: 'swap',
  chain: 'ethereum',
  from: { token: 'USDC', amount: 400n, decimals: 6 },
  to: 'ETH',
  via: '0xUNISWAP',
  maxSlippage: 50,
}

const curveSwap: SwapAction = {
  kind: 'swap',
  chain: 'ethereum',
  from: { token: 'USDC', amount: 400n, decimals: 6 },
  to: 'ETH',
  via: '0xCURVE',
  maxSlippage: 50,
}

describe('diffPolicies — no changes', () => {
  it('reports unchanged when policies are identical', () => {
    const diff = diffPolicies({
      policyA: basePolicy,
      policyB: basePolicy,
      actions: [{ action: smallTransfer }, { action: uniswapSwap }],
    })
    expect(diff.summary.changed).toBe(0)
    expect(diff.summary.unchanged).toBe(2)
    expect(diff.results.every(r => !r.changed)).toBe(true)
  })
})

describe('diffPolicies — newly_rejected', () => {
  it('detects newly rejected when spend cap is lowered', () => {
    const diff = diffPolicies({
      policyA: basePolicy,
      policyB: stricterPolicy,
      actions: [{ action: largeTransfer }],
    })
    expect(diff.summary.newlyRejected).toBe(1)
    expect(diff.results[0]?.direction).toBe('newly_rejected')
    expect(diff.results[0]?.evaluationA.passed).toBe(true)
    expect(diff.results[0]?.evaluationB.passed).toBe(false)
    expect(diff.results[0]?.evaluationB.rejectionReason).toBe('spend_exceeds_cap')
  })

  it('does not flag small transfer as changed when cap is lowered', () => {
    const diff = diffPolicies({
      policyA: basePolicy,
      policyB: stricterPolicy,
      actions: [{ action: smallTransfer }],
    })
    expect(diff.results[0]?.changed).toBe(false)
  })
})

describe('diffPolicies — newly_allowed', () => {
  it('detects newly allowed when spend cap is raised', () => {
    const diff = diffPolicies({
      policyA: stricterPolicy,
      policyB: basePolicy,
      actions: [{ action: largeTransfer }],
    })
    expect(diff.summary.newlyAllowed).toBe(1)
    expect(diff.results[0]?.direction).toBe('newly_allowed')
  })
})

describe('diffPolicies — rejection_reason_changed', () => {
  it('detects rejection reason change when allowlist and cap both change', () => {
    const tightCapAndCurve: Policy = {
      ...basePolicy,
      maxSpendPerTx: { token: 'USDC', amount: 300n, decimals: 6 },
      allowedContracts: [{ address: '0xCURVE', chain: 'ethereum' }],
    }

    const diff = diffPolicies({
      policyA: basePolicy,
      policyB: tightCapAndCurve,
      actions: [{ action: curveSwap }],
    })
    expect(diff.results[0]?.changed).toBe(true)
    expect(diff.results[0]?.direction).toBe('rejection_reason_changed')
    expect(diff.results[0]?.evaluationA.rejectionReason).toBe('contract_not_allowed')
    expect(diff.results[0]?.evaluationB.rejectionReason).toBe('spend_exceeds_cap')
  })
})

describe('diffPolicies — summary', () => {
  it('counts correctly across mixed results', () => {
    const diff = diffPolicies({
      policyA: basePolicy,
      policyB: stricterPolicy,
      actions: [
        { action: smallTransfer },
        { action: largeTransfer },
        { action: uniswapSwap },
      ],
    })
    expect(diff.summary.total).toBe(3)
    expect(diff.summary.changed).toBe(1)
    expect(diff.summary.newlyRejected).toBe(1)
    expect(diff.summary.unchanged).toBe(2)
  })

  it('counts requiresSimulation correctly', () => {
    const simPolicy: Policy = { ...basePolicy, requireSimulation: true }
    const diff = diffPolicies({
      policyA: basePolicy,
      policyB: simPolicy,
      actions: [{ action: smallTransfer }],
    })
    expect(diff.summary.requiresSimulation).toBe(1)
  })
})

describe('createTestActions', () => {
  it('generates actions for a policy with allowed contracts', () => {
    const actions = createTestActions(basePolicy)
    expect(actions.length).toBeGreaterThan(0)
    const kinds = actions.map(a => a.action.kind)
    expect(kinds).toContain('transfer')
    expect(kinds).toContain('swap')
  })

  it('includes an action at the spend limit', () => {
    const actions = createTestActions(basePolicy)
    const transfers = actions.filter(a => a.action.kind === 'transfer')
    const atLimit = transfers.find(
      a => (a.action as TransferAction).token.amount === basePolicy.maxSpendPerTx.amount,
    )
    expect(atLimit).toBeDefined()
  })

  it('includes an action over the spend limit', () => {
    const actions = createTestActions(basePolicy)
    const transfers = actions.filter(a => a.action.kind === 'transfer')
    const overLimit = transfers.find(
      a => (a.action as TransferAction).token.amount > basePolicy.maxSpendPerTx.amount,
    )
    expect(overLimit).toBeDefined()
  })
})

// suppress unused variable warning for looserPolicy and differentAllowlistPolicy
void looserPolicy
void differentAllowlistPolicy
