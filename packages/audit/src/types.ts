import type {
  Action,
  Policy,
  PolicyEvaluation,
  SimulationResult,
  ApprovalRequest,
  ApprovalDecision,
  PolicyRejectionReason,
  ChainId,
} from '@txfence/core'

export type AuditOutcome =
  | { status: 'success'; txHash: string; confirmedAtBlock: number; gasUsed: string }
  | { status: 'policy_rejected'; reason: PolicyRejectionReason | undefined }
  | { status: 'simulation_failed' }
  | { status: 'approval_timeout' }
  | { status: 'execution_failed'; reason: string }
  | { status: 'dry_run'; stoppedAt: 'policy' | 'simulation' | 'approval' | 'execution' }

export type AuditEntry = {
  id: string
  timestamp: number
  action: Action
  policySnapshot: Policy
  evaluation: PolicyEvaluation
  simulation?: SimulationResult
  approvalRequest?: ApprovalRequest
  approvalDecision?: ApprovalDecision
  outcome: AuditOutcome
  policyVersionId?: string
  intentId?: string
  intentStepId?: string
}

export type AuditFilter = {
  chain?: ChainId
  from?: number
  to?: number
  status?: AuditOutcome['status']
  actionKind?: Action['kind']
}

export type AuditLog = {
  record: (entry: AuditEntry) => Promise<void>
  query: (filter?: AuditFilter) => Promise<AuditEntry[]>
  get: (id: string) => Promise<AuditEntry | null>
}
