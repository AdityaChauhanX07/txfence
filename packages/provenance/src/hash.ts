// Canonical hashing for provenance records.
// Entry hash = SHA-256 of the canonical serialization of the record content.
// Canonical means: sorted keys, bigints as strings, no whitespace.
// The previousHash field is included in the hash — this is what forms the chain.
// Two identical records always produce the same hash regardless of
// the order fields were defined.

import { createHash } from 'node:crypto'
import type { ProvenanceRecordInput } from './types.js'

function canonicalize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as object).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}

export function computeEntryHash(
  previousHash: string,
  record: ProvenanceRecordInput,
): string {
  const content = {
    previousHash,
    agentId: record.agentId,
    policyVersionId: record.policyVersionId,
    action: record.action,
    simulationResult: record.simulationResult,
    approvalDecision: record.approvalDecision,
    approver: record.approver,
    submittedAtBlock: record.submittedAtBlock,
    submittedAtBlockHash: record.submittedAtBlockHash,
    outcome: record.outcome,
    timestamp: record.timestamp,
  }
  const canonical = JSON.stringify(canonicalize(content))
  return createHash('sha256').update(canonical).digest('hex')
}

// The previousHash for the first record in a chain.
// Convention: all zeros, same as Bitcoin's genesis block.
export const GENESIS_HASH = '0'.repeat(64)
