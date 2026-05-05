import type { Action, BoundAction } from './action.js'
import type { SimulationResult } from './simulation.js'

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
  | { status: 'approval_timeout'; action: BoundAction }
  | { status: 'execution_failed'; action: Action; txHash: string; reason: string }