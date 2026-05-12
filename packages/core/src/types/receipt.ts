import type { Action, BoundAction } from './action.js'
import type { SimulationResult } from './simulation.js'

export type ExecutionFailureReason =
  | { code: 'no_executor' }
  | { code: 'executor_threw'; message: string; cause?: unknown }
  | { code: 'signing_failed'; message: string }
  | { code: 'broadcast_failed'; message: string; txHash?: string }

export function formatExecutionFailureReason(reason: ExecutionFailureReason): string {
  switch (reason.code) {
    case 'no_executor':
      return 'No executor configured — set AGENT_PRIVATE_KEY to execute'
    case 'executor_threw':
      return `Executor error: ${reason.message}`
    case 'signing_failed':
      return `Signing failed: ${reason.message}`
    case 'broadcast_failed':
      return reason.txHash
        ? `Broadcast failed (txHash: ${reason.txHash}): ${reason.message}`
        : `Broadcast failed: ${reason.message}`
  }
}

export type PolicyRejectionReason =
  | 'contract_not_allowed'
  | 'chain_not_allowed'
  | 'spend_exceeds_cap'
  | 'cap_lock_unavailable'
  | 'bytecode_hash_mismatch'
  | 'owner_address_mismatch'
  | 'contract_entry_expired'
  | 'chain_id_mismatch'
  | 'simulation_required_but_failed'
  | 'gas_buffer_insufficient'
  | 'slippage_not_declared'

export type PolicyEvaluation = {
  passed: boolean
  checksRun: string[]
  rejectionReason?: PolicyRejectionReason
}

export type SuccessReceipt = {
  status: 'success'
  action: Action
  policyEvaluation: PolicyEvaluation
  simulation: SimulationResult
  txHash: string
  confirmedAtBlock: number
  confirmedAtMs: number
  gasUsed: bigint
}

export type ExecutionResult =
  | { status: 'success'; receipt: SuccessReceipt }
  | { status: 'policy_rejected'; action: Action; evaluation: PolicyEvaluation }
  | { status: 'simulation_failed'; action: Action; simulation: SimulationResult }
  | { status: 'simulation_stale'; action: Action; simulation: SimulationResult; stalenessMs: number }
  | { status: 'approval_timeout'; action: BoundAction }
  | { status: 'execution_failed'; action: Action; txHash: string; reason: ExecutionFailureReason }