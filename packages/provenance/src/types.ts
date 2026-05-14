// Transaction-level provenance chains.
// Every transaction gets a cryptographically linked provenance record.
// Records form a hash chain (each record includes the hash of the previous)
// and a Merkle tree (compact proofs that a record exists without revealing others).
//
// This is append-only with hash chaining — the same principle as git commits
// and blockchain headers, applied to transaction authorization records.
//
// Use case: hand a compliance officer cryptographic proof that every
// transaction followed your policy, with a specific policy version,
// a specific simulation result, and a specific approval decision.

import type { Action } from '@txfence/core'
import type { SimulationResult } from '@txfence/core'
import type { PolicyRejectionReason, SuccessReceipt } from '@txfence/core'
import type { ExecutionFailureReason } from '@txfence/core'
import type { ChainId } from '@txfence/core'

export type ProvenanceOutcome =
  | { status: 'success'; txHash: string; confirmedAtBlock: number; gasUsed: string }
  | { status: 'policy_rejected'; reason: PolicyRejectionReason }
  | { status: 'simulation_failed' }
  | { status: 'approval_timeout' }
  | { status: 'execution_failed'; reason: ExecutionFailureReason }
  | { status: 'simulation_stale'; stalenessMs: number }

export type ProvenanceRecord = {
  id: string
  previousHash: string
  entryHash: string
  timestamp: number

  agentId: string
  policyVersionId: string
  action: Action

  simulationResult?: SimulationResult

  approvalDecision?: 'approved' | 'rejected' | 'not_required'
  approver?: string

  submittedAtBlock?: number
  submittedAtBlockHash?: string

  outcome: ProvenanceOutcome

  receipt?: SuccessReceipt
}

export type ProvenanceRecordInput = Omit<ProvenanceRecord, 'id' | 'previousHash' | 'entryHash'>

export type MerkleProof = {
  entryHash: string
  siblings: Array<{
    hash: string
    position: 'left' | 'right'
  }>
  root: string
  leafIndex: number
}

export type ProvenanceFilter = {
  agentId?: string
  policyVersionId?: string
  status?: ProvenanceOutcome['status']
  from?: number
  to?: number
  chain?: ChainId
}

export type ChainViolation = {
  entryId: string
  entryHash: string
  violation: 'hash_mismatch' | 'chain_broken' | 'invalid_hash'
  details: string
}

export type ProvenanceVerificationResult = {
  valid: boolean
  entryCount: number
  firstHash: string
  lastHash: string
  merkleRoot: string
  violations: ChainViolation[]
  verifiedAt: number
}

export type ProvenanceChain = {
  append: (record: ProvenanceRecordInput) => Promise<ProvenanceRecord>

  get: (entryHash: string) => Promise<ProvenanceRecord | null>
  list: (filter?: ProvenanceFilter) => Promise<ProvenanceRecord[]>
  head: () => Promise<ProvenanceRecord | null>

  verify: () => Promise<ProvenanceVerificationResult>
  generateProof: (entryHash: string) => Promise<MerkleProof | null>
  verifyProof: (proof: MerkleProof) => boolean
  getMerkleRoot: () => Promise<string>
}
