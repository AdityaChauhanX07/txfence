import { describe, it, expect } from 'vitest'
import {
  buildMerkleTree,
  getMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
} from './merkle.js'

const leaves = ['aaaa', 'bbbb', 'cccc', 'dddd']
const singleLeaf = ['aaaa']
const oddLeaves = ['aaaa', 'bbbb', 'cccc']

describe('getMerkleRoot', () => {
  it('returns 64 zeros for empty array', () => {
    expect(getMerkleRoot([])).toBe('0'.repeat(64))
  })

  it('returns the leaf itself for a single leaf', () => {
    const root = getMerkleRoot(singleLeaf)
    expect(root).toBe('aaaa')
  })

  it('returns a deterministic root for the same leaves', () => {
    expect(getMerkleRoot(leaves)).toBe(getMerkleRoot(leaves))
  })

  it('returns different roots for different leaves', () => {
    expect(getMerkleRoot(['aaaa', 'bbbb'])).not.toBe(
      getMerkleRoot(['aaaa', 'cccc']),
    )
  })

  it('handles odd number of leaves', () => {
    expect(() => getMerkleRoot(oddLeaves)).not.toThrow()
    expect(getMerkleRoot(oddLeaves)).toHaveLength(64)
  })
})

describe('generateMerkleProof', () => {
  it('returns null for unknown hash', () => {
    expect(generateMerkleProof(leaves, 'unknown')).toBeNull()
  })

  it('generates a proof for a leaf', () => {
    const proof = generateMerkleProof(leaves, 'aaaa')
    expect(proof).not.toBeNull()
    expect(proof?.entryHash).toBe('aaaa')
    expect(proof?.root).toBe(getMerkleRoot(leaves))
    expect(proof?.siblings.length).toBeGreaterThan(0)
  })

  it('generates a proof for each leaf', () => {
    for (const leaf of leaves) {
      const proof = generateMerkleProof(leaves, leaf)
      expect(proof).not.toBeNull()
    }
  })
})

describe('verifyMerkleProof', () => {
  it('verifies a valid proof', () => {
    const proof = generateMerkleProof(leaves, 'aaaa')
    expect(proof).not.toBeNull()
    expect(verifyMerkleProof(proof!)).toBe(true)
  })

  it('verifies proof for every leaf in a 4-leaf tree', () => {
    for (const leaf of leaves) {
      const proof = generateMerkleProof(leaves, leaf)
      expect(verifyMerkleProof(proof!)).toBe(true)
    }
  })

  it('rejects a tampered proof (wrong root)', () => {
    const proof = generateMerkleProof(leaves, 'aaaa')!
    const tampered = { ...proof, root: 'b'.repeat(64) }
    expect(verifyMerkleProof(tampered)).toBe(false)
  })

  it('rejects a tampered proof (wrong sibling)', () => {
    const proof = generateMerkleProof(leaves, 'aaaa')!
    const tampered = {
      ...proof,
      siblings: proof.siblings.map((s, i) =>
        i === 0 ? { ...s, hash: 'c'.repeat(64) } : s,
      ),
    }
    expect(verifyMerkleProof(tampered)).toBe(false)
  })

  it('verifies proof for odd-length tree', () => {
    const proof = generateMerkleProof(oddLeaves, 'cccc')
    expect(proof).not.toBeNull()
    expect(verifyMerkleProof(proof!)).toBe(true)
  })

  it('verifies single-leaf tree', () => {
    const proof = generateMerkleProof(singleLeaf, 'aaaa')
    expect(proof).not.toBeNull()
    expect(verifyMerkleProof(proof!)).toBe(true)
  })
})

void buildMerkleTree
