import { describe, it, expect } from 'vitest'
import { createMemoryProvenanceChain } from './memory.js'
import { createFileProvenanceChain } from './file.js'
import { GENESIS_HASH } from './hash.js'
import type { ProvenanceChain, ProvenanceRecordInput } from './types.js'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

function runContractTests(
  name: string,
  makeChain: () => ProvenanceChain,
): void {
  describe(`${name} — append and read`, () => {
    it('appends a record and returns it with hash fields', async () => {
      const chain = makeChain()
      const record = await chain.append(baseInput)
      expect(record.id).toBeTruthy()
      expect(record.entryHash).toHaveLength(64)
      expect(record.previousHash).toBe(GENESIS_HASH)
      expect(record.agentId).toBe(baseInput.agentId)
    })

    it('chains previousHash correctly', async () => {
      const chain = makeChain()
      const r1 = await chain.append(baseInput)
      const r2 = await chain.append({ ...baseInput, timestamp: 2000000 })
      expect(r2.previousHash).toBe(r1.entryHash)
    })

    it('retrieves a record by entryHash', async () => {
      const chain = makeChain()
      const record = await chain.append(baseInput)
      const found = await chain.get(record.entryHash)
      expect(found?.id).toBe(record.id)
    })

    it('returns null for unknown entryHash', async () => {
      const chain = makeChain()
      expect(await chain.get('unknown')).toBeNull()
    })

    it('returns head as the most recent record', async () => {
      const chain = makeChain()
      await chain.append(baseInput)
      const r2 = await chain.append({ ...baseInput, timestamp: 2000000 })
      const h = await chain.head()
      expect(h?.id).toBe(r2.id)
    })

    it('returns null head for empty chain', async () => {
      const chain = makeChain()
      expect(await chain.head()).toBeNull()
    })

    it('lists all records', async () => {
      const chain = makeChain()
      await chain.append(baseInput)
      await chain.append({ ...baseInput, timestamp: 2000000 })
      const all = await chain.list()
      expect(all).toHaveLength(2)
    })

    it('filters list by agentId', async () => {
      const chain = makeChain()
      await chain.append(baseInput)
      await chain.append({ ...baseInput, agentId: '0xOTHER' })
      const filtered = await chain.list({ agentId: baseInput.agentId })
      expect(filtered).toHaveLength(1)
      expect(filtered[0]?.agentId).toBe(baseInput.agentId)
    })

    it('filters list by status', async () => {
      const chain = makeChain()
      await chain.append(baseInput)
      await chain.append({
        ...baseInput,
        outcome: { status: 'policy_rejected', reason: 'spend_exceeds_cap' },
      })
      const successes = await chain.list({ status: 'success' })
      expect(successes).toHaveLength(1)
    })
  })

  describe(`${name} — verification`, () => {
    it('verifies a valid chain', async () => {
      const chain = makeChain()
      await chain.append(baseInput)
      await chain.append({ ...baseInput, timestamp: 2000000 })
      const result = await chain.verify()
      expect(result.valid).toBe(true)
      expect(result.entryCount).toBe(2)
      expect(result.violations).toHaveLength(0)
    })

    it('returns valid for empty chain', async () => {
      const chain = makeChain()
      const result = await chain.verify()
      expect(result.valid).toBe(true)
      expect(result.entryCount).toBe(0)
    })
  })

  describe(`${name} — Merkle proofs`, () => {
    it('generates and verifies a Merkle proof', async () => {
      const chain = makeChain()
      const r1 = await chain.append(baseInput)
      await chain.append({ ...baseInput, timestamp: 2000000 })
      const proof = await chain.generateProof(r1.entryHash)
      expect(proof).not.toBeNull()
      expect(chain.verifyProof(proof!)).toBe(true)
    })

    it('returns null proof for unknown hash', async () => {
      const chain = makeChain()
      await chain.append(baseInput)
      expect(await chain.generateProof('unknown')).toBeNull()
    })

    it('getMerkleRoot returns consistent root', async () => {
      const chain = makeChain()
      await chain.append(baseInput)
      const root1 = await chain.getMerkleRoot()
      const root2 = await chain.getMerkleRoot()
      expect(root1).toBe(root2)
      expect(root1).toHaveLength(64)
    })
  })
}

runContractTests('MemoryProvenanceChain', () => createMemoryProvenanceChain())

runContractTests('FileProvenanceChain', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'txfence-provenance-'))
  return createFileProvenanceChain(join(tmpDir, 'provenance.jsonl'))
})
