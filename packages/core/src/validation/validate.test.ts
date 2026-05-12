import { describe, it, expect } from 'vitest'
import { validateConfig } from './validate.js'
import type { Policy } from '../types/policy.js'

const validPolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 6 },
  allowedContracts: [{ address: '0xUNISWAP', chain: 'ethereum' }],
  requireSimulation: true,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent',
}

describe('validateConfig — valid policy', () => {
  it('returns valid: true for a well-configured policy', () => {
    const result = validateConfig(validPolicy)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })
})

describe('validateConfig — errors', () => {
  it('errors when chains is empty', () => {
    const result = validateConfig({ ...validPolicy, chains: [] })
    expect(result.valid).toBe(false)
    const err = result.errors.find(e => e.field === 'chains')
    expect(err).toBeDefined()
    expect(err?.severity).toBe('error')
  })

  it('errors when gasBufferMultiplier is below 1.0', () => {
    const result = validateConfig({ ...validPolicy, gasBufferMultiplier: 0.8 })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'gasBufferMultiplier')).toBe(true)
  })

  it('errors when humanApprovalTimeoutMs is below 1000', () => {
    const result = validateConfig({ ...validPolicy, humanApprovalTimeoutMs: 500 })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'humanApprovalTimeoutMs')).toBe(true)
  })

  it('errors when maxSpendPerTx.decimals is 0', () => {
    const result = validateConfig({
      ...validPolicy,
      maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 0 },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'maxSpendPerTx.decimals')).toBe(true)
  })

  it('errors when threshold decimals mismatch maxSpendPerTx for same token', () => {
    const result = validateConfig({
      ...validPolicy,
      humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 18 },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'humanApprovalThreshold.decimals')).toBe(true)
  })
})

describe('validateConfig — warnings', () => {
  it('warns when USDC uses 18 decimals', () => {
    const result = validateConfig({
      ...validPolicy,
      maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 18 },
      humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 18 },
    })
    expect(result.warnings.some(w => w.field === 'maxSpendPerTx.decimals')).toBe(true)
  })

  it('warns when ETH uses 6 decimals', () => {
    const result = validateConfig({
      ...validPolicy,
      maxSpendPerTx: { token: 'ETH', amount: 1000n, decimals: 6 },
      humanApprovalThreshold: { token: 'ETH', amount: 10000n, decimals: 6 },
    })
    expect(result.warnings.some(w => w.field === 'maxSpendPerTx.decimals')).toBe(true)
  })

  it('warns when approval threshold is below spend cap', () => {
    const result = validateConfig({
      ...validPolicy,
      maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 6 },
      humanApprovalThreshold: { token: 'USDC', amount: 500n, decimals: 6 },
    })
    expect(result.warnings.some(w => w.field === 'humanApprovalThreshold.amount')).toBe(true)
  })

  it('warns when gasBufferMultiplier exceeds 3.0', () => {
    const result = validateConfig({ ...validPolicy, gasBufferMultiplier: 4.0 })
    expect(result.warnings.some(w => w.field === 'gasBufferMultiplier')).toBe(true)
  })

  it('warns when allowedContracts is empty and simulation not required', () => {
    const result = validateConfig({
      ...validPolicy,
      allowedContracts: [],
      requireSimulation: false,
    })
    expect(result.warnings.some(w => w.field === 'allowedContracts')).toBe(true)
  })

  it('warns when a contract entry has expired', () => {
    const result = validateConfig({
      ...validPolicy,
      allowedContracts: [{
        address: '0xUNISWAP',
        chain: 'ethereum',
        expiresAt: Date.now() - 1000,
      }],
    })
    expect(result.warnings.some(w => w.field.includes('0xUNISWAP'))).toBe(true)
  })

  it('does not warn about different tokens with different decimals', () => {
    const result = validateConfig({
      ...validPolicy,
      maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 6 },
      humanApprovalThreshold: { token: 'ETH', amount: 1000n, decimals: 18 },
    })
    expect(result.errors.filter(e => e.field === 'humanApprovalThreshold.decimals')).toHaveLength(0)
  })

  it('returns both errors and warnings when multiple issues exist', () => {
    const result = validateConfig({
      ...validPolicy,
      chains: [],
      maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 18 },
      humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 18 },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
