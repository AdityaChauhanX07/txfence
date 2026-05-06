import { describe, it, expect } from 'vitest'
import { bigintReplacer, serializeWithBigInt, parseWithBigInt } from './bigint.js'
import {
  reviveTokenAmount,
  revivePolicy,
  reviveAction,
  reviveSimulationResult,
  reviveSuccessReceipt,
} from './revival.js'
import type { TransferAction } from '@txfence/core'

describe('bigintReplacer', () => {
  it('converts bigint to string', () => {
    const result = JSON.stringify({ amount: 1000n }, bigintReplacer)
    expect(result).toBe('{"amount":"1000"}')
  })

  it('leaves non-bigint values unchanged', () => {
    const result = JSON.stringify({ name: 'test', count: 42 }, bigintReplacer)
    expect(result).toBe('{"name":"test","count":42}')
  })

  it('handles nested bigints', () => {
    const result = JSON.stringify({ token: { amount: 500n } }, bigintReplacer)
    expect(result).toBe('{"token":{"amount":"500"}}')
  })
})

describe('serializeWithBigInt and parseWithBigInt', () => {
  it('round-trips a simple object with bigint (amount remains string after parse)', () => {
    const obj = { amount: 1000n, name: 'test' }
    const serialized = serializeWithBigInt(obj)
    const parsed = parseWithBigInt(serialized) as { amount: string; name: string }
    expect(parsed.name).toBe('test')
    expect(parsed.amount).toBe('1000')
    expect(typeof parsed.amount).toBe('string')
  })
})

describe('reviveTokenAmount', () => {
  it('converts amount string to bigint', () => {
    const obj: Record<string, unknown> = { token: 'USDC', amount: '1000', decimals: 6 }
    reviveTokenAmount(obj)
    expect(obj['amount']).toBe(1000n)
    expect(typeof obj['amount']).toBe('bigint')
  })

  it('leaves amount alone if already a number (not a string)', () => {
    const obj: Record<string, unknown> = { token: 'USDC', amount: 1000, decimals: 6 }
    reviveTokenAmount(obj)
    expect(obj['amount']).toBe(1000)
  })
})

describe('revivePolicy', () => {
  it('revives maxSpendPerTx and humanApprovalThreshold amounts', () => {
    const policy: Record<string, unknown> = {
      chains: ['ethereum'],
      maxSpendPerTx: { token: 'USDC', amount: '1000', decimals: 6 },
      allowedContracts: [],
      requireSimulation: false,
      gasBufferMultiplier: 1.2,
      humanApprovalThreshold: { token: 'USDC', amount: '10000', decimals: 6 },
      humanApprovalTimeoutMs: 30000,
      capLockMode: 'per-agent',
    }
    revivePolicy(policy)
    expect((policy['maxSpendPerTx'] as Record<string, unknown>)['amount']).toBe(1000n)
    expect((policy['humanApprovalThreshold'] as Record<string, unknown>)['amount']).toBe(10000n)
  })
})

describe('reviveAction', () => {
  it('revives TransferAction token amount', () => {
    const action: Record<string, unknown> = {
      kind: 'transfer',
      chain: 'ethereum',
      token: { token: 'ETH', amount: '100000000000000000', decimals: 18 },
      to: '0x123',
    }
    reviveAction(action)
    expect((action['token'] as Record<string, unknown>)['amount']).toBe(100000000000000000n)
  })

  it('revives SwapAction from amount', () => {
    const action: Record<string, unknown> = {
      kind: 'swap',
      chain: 'ethereum',
      from: { token: 'USDC', amount: '500', decimals: 6 },
      to: 'ETH',
      via: '0xROUTER',
      maxSlippage: 50,
    }
    reviveAction(action)
    expect((action['from'] as Record<string, unknown>)['amount']).toBe(500n)
  })
})

describe('reviveSimulationResult', () => {
  it('revives gasEstimate to bigint', () => {
    const sim: Record<string, unknown> = {
      success: true,
      wouldRevert: false,
      chain: 'ethereum',
      simulatedAtBlock: 1000,
      gasEstimate: '21000',
      gasBufferApplied: 1.2,
      coverageLevel: 'basic',
      caveats: [],
      provider: 'eth_call',
    }
    reviveSimulationResult(sim)
    expect(sim['gasEstimate']).toBe(21000n)
  })
})

describe('reviveSuccessReceipt', () => {
  it('revives gasUsed and nested fields', () => {
    const receipt: Record<string, unknown> = {
      status: 'success',
      action: {
        kind: 'transfer',
        chain: 'ethereum',
        token: { token: 'ETH', amount: '100000000000000000', decimals: 18 },
        to: '0x123',
      },
      policyEvaluation: { passed: true, checksRun: [] },
      simulation: {
        success: true,
        wouldRevert: false,
        chain: 'ethereum',
        simulatedAtBlock: 1000,
        gasEstimate: '21000',
        gasBufferApplied: 1.2,
        coverageLevel: 'basic',
        caveats: [],
        provider: 'eth_call',
      },
      txHash: '0xabc',
      confirmedAtBlock: 1000,
      confirmedAtMs: Date.now(),
      gasUsed: '21000',
    }
    const revived = reviveSuccessReceipt(receipt)
    expect(revived.gasUsed).toBe(21000n)
    expect(typeof revived.gasUsed).toBe('bigint')
    expect(revived.simulation.gasEstimate).toBe(21000n)
    expect((revived.action as TransferAction).token.amount).toBe(100000000000000000n)
  })
})
