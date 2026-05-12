import { describe, it, expect } from 'vitest'
import {
  getActionPositionChanges,
  mergePositionChanges,
  isSingleTokenIntent,
  getDominantToken,
  analyzeIntentPosition,
} from './position.js'
import type { TransferAction, SwapAction, ContractCallAction } from '../types/action.js'
import type { IntentStep } from './types.js'

const makeTransferStep = (
  id: string,
  token: string,
  amount: bigint,
  dependsOn?: string[],
): IntentStep => ({
  id,
  action: {
    kind: 'transfer' as const,
    chain: 'ethereum' as const,
    token: { token, amount, decimals: 6 },
    to: '0x0000000000000000000000000000000000000001',
  },
  ...(dependsOn !== undefined ? { dependsOn } : {}),
})

// ── getActionPositionChanges ──────────────────────────────────────────────────

describe('getActionPositionChanges', () => {
  it('returns outflow for TransferAction', () => {
    const action: TransferAction = {
      kind: 'transfer', chain: 'ethereum',
      token: { token: 'USDC', amount: 1000n, decimals: 6 },
      to: '0x123',
    }
    const changes = getActionPositionChanges(action)
    expect(changes).toHaveLength(1)
    expect(changes[0]?.token).toBe('USDC')
    expect(changes[0]?.amount).toBe(-1000n)
    expect(changes[0]?.chain).toBe('ethereum')
  })

  it('returns outflow for SwapAction (from amount)', () => {
    const action: SwapAction = {
      kind: 'swap', chain: 'ethereum',
      from: { token: 'USDC', amount: 500n, decimals: 6 },
      to: 'ETH', via: '0xROUTER', maxSlippage: 50,
    }
    const changes = getActionPositionChanges(action)
    expect(changes).toHaveLength(1)
    expect(changes[0]?.token).toBe('USDC')
    expect(changes[0]?.amount).toBe(-500n)
  })

  it('returns outflow for ContractCallAction with value', () => {
    const action: ContractCallAction = {
      kind: 'contract_call', chain: 'ethereum',
      contract: '0xCONTRACT', method: 'deposit', args: [],
      value: { token: 'ETH', amount: 100n, decimals: 18 },
    }
    const changes = getActionPositionChanges(action)
    expect(changes).toHaveLength(1)
    expect(changes[0]?.amount).toBe(-100n)
  })

  it('returns empty for ContractCallAction without value', () => {
    const action: ContractCallAction = {
      kind: 'contract_call', chain: 'ethereum',
      contract: '0xCONTRACT', method: 'claim', args: [],
    }
    const changes = getActionPositionChanges(action)
    expect(changes).toHaveLength(0)
  })
})

// ── mergePositionChanges ──────────────────────────────────────────────────────

describe('mergePositionChanges', () => {
  it('merges same token on same chain', () => {
    const a = [{ token: 'USDC', amount: -500n, chain: 'ethereum' as const }]
    const b = [{ token: 'USDC', amount: -300n, chain: 'ethereum' as const }]
    const merged = mergePositionChanges(a, b)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.amount).toBe(-800n)
  })

  it('keeps different tokens separate', () => {
    const a = [{ token: 'USDC', amount: -500n, chain: 'ethereum' as const }]
    const b = [{ token: 'ETH', amount: -100n, chain: 'ethereum' as const }]
    const merged = mergePositionChanges(a, b)
    expect(merged).toHaveLength(2)
  })

  it('handles empty arrays', () => {
    const result = mergePositionChanges([], [])
    expect(result).toHaveLength(0)
  })

  it('keeps different chains separate for same token', () => {
    const a = [{ token: 'USDC', amount: -500n, chain: 'ethereum' as const }]
    const b = [{ token: 'USDC', amount: -300n, chain: 'base' as const }]
    const merged = mergePositionChanges(a, b)
    expect(merged).toHaveLength(2)
  })
})

// ── isSingleTokenIntent and getDominantToken ──────────────────────────────────

describe('isSingleTokenIntent and getDominantToken', () => {
  it('returns true for single token intent', () => {
    const steps = [
      makeTransferStep('A', 'USDC', 500n),
      makeTransferStep('B', 'USDC', 300n, ['A']),
    ]
    expect(isSingleTokenIntent(steps)).toBe(true)
    expect(getDominantToken(steps)).toBe('USDC')
  })

  it('returns false for multi-token intent', () => {
    const steps = [
      makeTransferStep('A', 'USDC', 500n),
      makeTransferStep('B', 'ETH', 100n, ['A']),
    ]
    expect(isSingleTokenIntent(steps)).toBe(false)
    expect(getDominantToken(steps)).toBeUndefined()
  })

  it('returns true for single step', () => {
    const steps = [makeTransferStep('A', 'ETH', 100n)]
    expect(isSingleTokenIntent(steps)).toBe(true)
  })
})

// ── analyzeIntentPosition ─────────────────────────────────────────────────────

describe('analyzeIntentPosition', () => {
  it('computes total gross outflow', () => {
    const steps = [
      makeTransferStep('A', 'USDC', 500n),
      makeTransferStep('B', 'USDC', 300n, ['A']),
    ]
    const analysis = analyzeIntentPosition(steps, ['A', 'B'])
    expect(analysis.totalGrossOutflow).toBe(800n)
  })

  it('computes snapshots in execution plan order', () => {
    const steps = [
      makeTransferStep('A', 'USDC', 500n),
      makeTransferStep('B', 'USDC', 300n, ['A']),
    ]
    const analysis = analyzeIntentPosition(steps, ['A', 'B'])
    expect(analysis.steps).toHaveLength(2)
    expect(analysis.steps[0]?.stepId).toBe('A')
    expect(analysis.steps[0]?.grossOutflowSoFar).toBe(500n)
    expect(analysis.steps[1]?.stepId).toBe('B')
    expect(analysis.steps[1]?.grossOutflowSoFar).toBe(800n)
  })

  it('computes net change correctly', () => {
    const steps = [
      makeTransferStep('A', 'USDC', 500n),
      makeTransferStep('B', 'USDC', 300n, ['A']),
    ]
    const analysis = analyzeIntentPosition(steps, ['A', 'B'])
    const usdcChange = analysis.netChange.find(c => c.token === 'USDC')
    expect(usdcChange?.amount).toBe(-800n)
  })

  it('tracks maxIntermediateExposure', () => {
    const steps = [
      makeTransferStep('A', 'USDC', 500n),
      makeTransferStep('B', 'USDC', 300n),
    ]
    const analysis = analyzeIntentPosition(steps, ['A', 'B'])
    expect(analysis.maxIntermediateExposure).toBeGreaterThan(0n)
  })

  it('identifies single token and dominant token', () => {
    const steps = [
      makeTransferStep('A', 'USDC', 500n),
      makeTransferStep('B', 'USDC', 300n),
    ]
    const analysis = analyzeIntentPosition(steps, ['A', 'B'])
    expect(analysis.isSingleToken).toBe(true)
    expect(analysis.dominantToken).toBe('USDC')
  })
})
