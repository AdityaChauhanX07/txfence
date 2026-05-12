import { describe, it, expect } from 'vitest'
import { getPolicyVersionId, createPolicyVersion } from './hash.js'
import { createPolicyVersionStore } from './store.js'
import type { Policy } from '../types/policy.js'

const policyA: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 6 },
  allowedContracts: [{ address: '0xUNISWAP', chain: 'ethereum' }],
  requireSimulation: true,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent',
}

const policyB: Policy = {
  ...policyA,
  maxSpendPerTx: { token: 'USDC', amount: 2000n, decimals: 6 },
}

// ── getPolicyVersionId ────────────────────────────────────────────────────────

describe('getPolicyVersionId', () => {
  it('returns a 64-character hex string', () => {
    const id = getPolicyVersionId(policyA)
    expect(id).toHaveLength(64)
    expect(id).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns the same ID for the same policy', () => {
    const id1 = getPolicyVersionId(policyA)
    const id2 = getPolicyVersionId(policyA)
    expect(id1).toBe(id2)
  })

  it('returns different IDs for different policies', () => {
    const idA = getPolicyVersionId(policyA)
    const idB = getPolicyVersionId(policyB)
    expect(idA).not.toBe(idB)
  })

  it('is stable regardless of object property order', () => {
    const policyReordered: Policy = {
      capLockMode: 'per-agent',
      humanApprovalTimeoutMs: 30000,
      humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
      gasBufferMultiplier: 1.2,
      requireSimulation: true,
      allowedContracts: [{ address: '0xUNISWAP', chain: 'ethereum' }],
      maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 6 },
      chains: ['ethereum'],
    }
    expect(getPolicyVersionId(policyA)).toBe(getPolicyVersionId(policyReordered))
  })

  it('handles bigint fields correctly', () => {
    const id = getPolicyVersionId(policyA)
    expect(id).toHaveLength(64)
  })
})

// ── createPolicyVersion ───────────────────────────────────────────────────────

describe('createPolicyVersion', () => {
  it('creates a version with the correct id', () => {
    const version = createPolicyVersion(policyA)
    expect(version.id).toBe(getPolicyVersionId(policyA))
  })

  it('includes createdAt timestamp', () => {
    const before = Date.now()
    const version = createPolicyVersion(policyA)
    const after = Date.now()
    expect(version.createdAt).toBeGreaterThanOrEqual(before)
    expect(version.createdAt).toBeLessThanOrEqual(after)
  })

  it('includes optional metadata', () => {
    const version = createPolicyVersion(policyA, { label: 'treasury-v3', author: 'alice' })
    expect(version.label).toBe('treasury-v3')
    expect(version.author).toBe('alice')
  })

  it('omits metadata when not provided', () => {
    const version = createPolicyVersion(policyA)
    expect(version.label).toBeUndefined()
    expect(version.author).toBeUndefined()
  })
})

// ── createPolicyVersionStore ──────────────────────────────────────────────────

describe('createPolicyVersionStore', () => {
  it('registers and retrieves a version by id', () => {
    const store = createPolicyVersionStore()
    const version = createPolicyVersion(policyA, { label: 'v1' })
    store.register(version)
    const found = store.get(version.id)
    expect(found).toBeDefined()
    expect(found?.label).toBe('v1')
  })

  it('returns undefined for unknown id', () => {
    const store = createPolicyVersionStore()
    expect(store.get('unknown-id')).toBeUndefined()
  })

  it('lists versions sorted by createdAt descending', async () => {
    const store = createPolicyVersionStore()
    const v1 = createPolicyVersion(policyA, { label: 'v1' })
    await new Promise(r => setTimeout(r, 5))
    const v2 = createPolicyVersion(policyB, { label: 'v2' })
    store.register(v1)
    store.register(v2)
    const list = store.list()
    expect(list[0]?.label).toBe('v2')
    expect(list[1]?.label).toBe('v1')
  })

  it('finds version by policy object', () => {
    const store = createPolicyVersionStore()
    const version = createPolicyVersion(policyA)
    store.register(version)
    const found = store.getByPolicy(policyA)
    expect(found?.id).toBe(version.id)
  })

  it('returns undefined for unregistered policy', () => {
    const store = createPolicyVersionStore()
    expect(store.getByPolicy(policyA)).toBeUndefined()
  })
})
