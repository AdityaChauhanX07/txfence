// File-based ProvenanceChain implementation.
// Stores records as newline-delimited JSON (JSONL) with write-then-rename
// for atomic appends. Each line is one ProvenanceRecord serialized as JSON.
//
// Atomic write pattern: write to a temp file, then rename over the target.
// rename() is atomic on POSIX systems — the file is never in a partial state.
// On Windows, rename() may fail if the target exists; we handle this.
//
// The file grows linearly. Verification requires reading the full file.
// For very large chains (>100k records), consider the PostgreSQL implementation.

import { randomUUID } from 'node:crypto'
import {
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
  mkdirSync,
} from 'node:fs'
import { dirname } from 'node:path'
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
import { bigintReplacer } from '@txfence/core'

export function createFileProvenanceChain(filePath: string): ProvenanceChain {
  function ensureDir(): void {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  function reviveRecord(raw: Record<string, unknown>): ProvenanceRecord {
    const action = raw['action'] as Record<string, unknown>
    if (action['kind'] === 'transfer') {
      const token = action['token'] as Record<string, unknown>
      if (typeof token['amount'] === 'string') {
        token['amount'] = BigInt(token['amount'])
      }
    }
    if (action['kind'] === 'swap') {
      const from = action['from'] as Record<string, unknown>
      if (typeof from['amount'] === 'string') {
        from['amount'] = BigInt(from['amount'])
      }
    }
    if (action['kind'] === 'contract_call' && action['value'] !== undefined) {
      const value = action['value'] as Record<string, unknown>
      if (typeof value['amount'] === 'string') {
        value['amount'] = BigInt(value['amount'])
      }
    }
    if (raw['simulationResult'] !== undefined) {
      const sim = raw['simulationResult'] as Record<string, unknown>
      if (typeof sim['gasEstimate'] === 'string') {
        sim['gasEstimate'] = BigInt(sim['gasEstimate'])
      }
    }
    return raw as unknown as ProvenanceRecord
  }

  function readAll(): ProvenanceRecord[] {
    if (!existsSync(filePath)) return []
    const content = readFileSync(filePath, 'utf-8').trim()
    if (content.length === 0) return []
    return content.split('\n').map(line => {
      const parsed = JSON.parse(line) as Record<string, unknown>
      return reviveRecord(parsed)
    })
  }

  function appendRecord(record: ProvenanceRecord): void {
    ensureDir()
    const line = JSON.stringify(record, bigintReplacer) + '\n'
    const tmpPath = filePath + '.tmp'

    const existing = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : ''
    writeFileSync(tmpPath, existing + line, 'utf-8')
    try {
      renameSync(tmpPath, filePath)
    } catch {
      writeFileSync(filePath, existing + line, 'utf-8')
    }
  }

  async function append(
    input: ProvenanceRecordInput,
  ): Promise<ProvenanceRecord> {
    const records = readAll()
    const previousHash =
      records.length > 0 ? records[records.length - 1]!.entryHash : GENESIS_HASH
    const entryHash = computeEntryHash(previousHash, input)
    const record: ProvenanceRecord = {
      id: randomUUID(),
      previousHash,
      entryHash,
      ...input,
    }
    appendRecord(record)
    return record
  }

  async function get(entryHash: string): Promise<ProvenanceRecord | null> {
    const records = readAll()
    return records.find(r => r.entryHash === entryHash) ?? null
  }

  async function list(
    filter?: ProvenanceFilter,
  ): Promise<ProvenanceRecord[]> {
    let records = readAll()
    if (filter?.agentId !== undefined) {
      const v = filter.agentId
      records = records.filter(r => r.agentId === v)
    }
    if (filter?.policyVersionId !== undefined) {
      const v = filter.policyVersionId
      records = records.filter(r => r.policyVersionId === v)
    }
    if (filter?.status !== undefined) {
      const v = filter.status
      records = records.filter(r => r.outcome.status === v)
    }
    if (filter?.from !== undefined) {
      const v = filter.from
      records = records.filter(r => r.timestamp >= v)
    }
    if (filter?.to !== undefined) {
      const v = filter.to
      records = records.filter(r => r.timestamp <= v)
    }
    if (filter?.chain !== undefined) {
      const v = filter.chain
      records = records.filter(r => r.action.chain === v)
    }
    return records
  }

  async function head(): Promise<ProvenanceRecord | null> {
    const records = readAll()
    return records[records.length - 1] ?? null
  }

  async function verify(): Promise<ProvenanceVerificationResult> {
    const records = readAll()
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
          details: `Entry ${i}: previousHash mismatch`,
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
          details: `Entry ${i}: hash mismatch. Record may have been tampered with.`,
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
    const records = readAll()
    const leafHashes = records.map(r => r.entryHash)
    return generateMerkleProof(leafHashes, entryHash)
  }

  function verifyProof(proof: MerkleProof): boolean {
    return verifyMerkleProof(proof)
  }

  async function getMerkleRootFn(): Promise<string> {
    const records = readAll()
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
