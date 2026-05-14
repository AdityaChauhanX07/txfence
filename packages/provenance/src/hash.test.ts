import { describe, it, expect } from 'vitest'
import { computeEntryHash, GENESIS_HASH } from './hash.js'
import type { ProvenanceRecordInput } from './types.js'

const baseInput: ProvenanceRecordInput = {
  agentId: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  policyVersionId: 'a'.repeat(64),
  timestamp: 1000000,
  action: {
    kind: 'transfer',
    chain: 'ethereum',
    token: { token: 'USDC', amount: 1000n, decimals: 6 },
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  },
  outcome: {
    status: 'success',
    txHash: '0xabc',
    confirmedAtBlock: 1000,
    gasUsed: '21000',
  },
}

describe('computeEntryHash', () => {
  it('returns a 64-character hex string', () => {
    const hash = computeEntryHash(GENESIS_HASH, baseInput)
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for the same input', () => {
    const h1 = computeEntryHash(GENESIS_HASH, baseInput)
    const h2 = computeEntryHash(GENESIS_HASH, baseInput)
    expect(h1).toBe(h2)
  })

  it('changes when previousHash changes', () => {
    const h1 = computeEntryHash(GENESIS_HASH, baseInput)
    const h2 = computeEntryHash('b'.repeat(64), baseInput)
    expect(h1).not.toBe(h2)
  })

  it('changes when agentId changes', () => {
    const h1 = computeEntryHash(GENESIS_HASH, baseInput)
    const h2 = computeEntryHash(GENESIS_HASH, { ...baseInput, agentId: '0xOTHER' })
    expect(h1).not.toBe(h2)
  })

  it('changes when outcome changes', () => {
    const h1 = computeEntryHash(GENESIS_HASH, baseInput)
    const h2 = computeEntryHash(GENESIS_HASH, {
      ...baseInput,
      outcome: { status: 'policy_rejected', reason: 'spend_exceeds_cap' },
    })
    expect(h1).not.toBe(h2)
  })

  it('handles bigint amounts without throwing', () => {
    expect(() => computeEntryHash(GENESIS_HASH, baseInput)).not.toThrow()
  })

  it('GENESIS_HASH is 64 zeros', () => {
    expect(GENESIS_HASH).toHaveLength(64)
    expect(GENESIS_HASH).toBe(
      '0000000000000000000000000000000000000000000000000000000000000000',
    )
  })
})
