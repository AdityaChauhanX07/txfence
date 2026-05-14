// In-memory ProvenanceChain implementation.
// Suitable for testing and single-process environments where
// persistence is not required. All records are lost on process exit.

import { randomUUID } from 'node:crypto'
import type {
  ProvenanceChain,
  ProvenanceRecord,
  ProvenanceRecordInput,
  ProvenanceFilter,
  ProvenanceVerificationResult,
  MerkleProof,
} from './types.js'
import { computeEntryHash, GENESIS_HASH } from './hash.js'
import {
  getMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
} from './merkle.js'

export function createMemoryProvenanceChain(): ProvenanceChain {
  const records: ProvenanceRecord[] = []

  async function append(
    input: ProvenanceRecordInput,
  ): Promise<ProvenanceRecord> {
    const previousHash =
      records.length > 0 ? records[records.length - 1]!.entryHash : GENESIS_HASH
    const entryHash = computeEntryHash(previousHash, input)
    const record: ProvenanceRecord = {
      id: randomUUID(),
      previousHash,
      entryHash,
      ...input,
    }
    records.push(record)
    return record
  }

  async function get(entryHash: string): Promise<ProvenanceRecord | null> {
    return records.find(r => r.entryHash === entryHash) ?? null
  }

  async function list(
    filter?: ProvenanceFilter,
  ): Promise<ProvenanceRecord[]> {
    let result = [...records]
    if (filter?.agentId !== undefined) {
      const v = filter.agentId
      result = result.filter(r => r.agentId === v)
    }
    if (filter?.policyVersionId !== undefined) {
      const v = filter.policyVersionId
      result = result.filter(r => r.policyVersionId === v)
    }
    if (filter?.status !== undefined) {
      const v = filter.status
      result = result.filter(r => r.outcome.status === v)
    }
    if (filter?.from !== undefined) {
      const v = filter.from
      result = result.filter(r => r.timestamp >= v)
    }
    if (filter?.to !== undefined) {
      const v = filter.to
      result = result.filter(r => r.timestamp <= v)
    }
    if (filter?.chain !== undefined) {
      const v = filter.chain
      result = result.filter(r => r.action.chain === v)
    }
    return result
  }

  async function head(): Promise<ProvenanceRecord | null> {
    return records[records.length - 1] ?? null
  }

  async function verify(): Promise<ProvenanceVerificationResult> {
    const violations: ProvenanceVerificationResult['violations'] = []

    for (let i = 0; i < records.length; i++) {
      const record = records[i]!
      const expectedPreviousHash =
        i === 0 ? GENESIS_HASH : records[i - 1]!.entryHash

      if (record.previousHash !== expectedPreviousHash) {
        violations.push({
          entryId: record.id,
          entryHash: record.entryHash,
          violation: 'chain_broken',
          details: `Entry ${i}: previousHash mismatch. Expected ${expectedPreviousHash.slice(0, 8)}... got ${record.previousHash.slice(0, 8)}...`,
        })
      }

      const { id: _id, previousHash, entryHash, ...input } = record
      void _id
      const recomputed = computeEntryHash(previousHash, input)
      if (recomputed !== entryHash) {
        violations.push({
          entryId: record.id,
          entryHash: record.entryHash,
          violation: 'hash_mismatch',
          details: `Entry ${i}: hash mismatch. Stored ${entryHash.slice(0, 8)}... recomputed ${recomputed.slice(0, 8)}...`,
        })
      }
    }

    const leafHashes = records.map(r => r.entryHash)
    const merkleRoot = getMerkleRoot(leafHashes)

    return {
      valid: violations.length === 0,
      entryCount: records.length,
      firstHash: records[0]?.entryHash ?? GENESIS_HASH,
      lastHash: records[records.length - 1]?.entryHash ?? GENESIS_HASH,
      merkleRoot,
      violations,
      verifiedAt: Date.now(),
    }
  }

  async function generateProof(entryHash: string): Promise<MerkleProof | null> {
    const leafHashes = records.map(r => r.entryHash)
    return generateMerkleProof(leafHashes, entryHash)
  }

  function verifyProof(proof: MerkleProof): boolean {
    return verifyMerkleProof(proof)
  }

  async function getMerkleRootFn(): Promise<string> {
    const leafHashes = records.map(r => r.entryHash)
    return getMerkleRoot(leafHashes)
  }

  return {
    append,
    get,
    list,
    head,
    verify,
    generateProof,
    verifyProof,
    getMerkleRoot: getMerkleRootFn,
  }
}
