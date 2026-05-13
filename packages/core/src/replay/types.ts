// Replay and backtesting types.
// The replay engine feeds historical audit log entries through a new policy
// configuration to answer: "What would have happened if this policy had been
// active when these transactions were submitted?"
//
// The audit log already has action payloads, evaluations, and timestamps.
// Replay re-evaluates each entry under the new policy and classifies the change.

import type { Action } from '../types/action.js'
import type { ChainId, Policy } from '../types/policy.js'
import type { PolicyEvaluation } from '../types/receipt.js'
import type { SimulationResult } from '../types/simulation.js'
import type { ChangedCheck } from '../diff/types.js'

export type ReplayDirection =
  | 'newly_allowed'
  | 'newly_rejected'
  | 'rejection_reason_changed'

export type ReplayEntry = {
  auditEntryId: string
  timestamp: number
  action: Action
  originalEvaluation: PolicyEvaluation
  replayEvaluation: PolicyEvaluation
  originalStatus: string            // from AuditOutcome.status
  changed: boolean
  direction?: ReplayDirection
  changedChecks: ChangedCheck[]
}

export type ReplayResult = {
  policy: Policy
  replayedAt: number
  entries: ReplayEntry[]
  summary: {
    total: number
    changed: number
    newlyAllowed: number
    newlyRejected: number
    rejectionReasonChanged: number
    unchanged: number
    skipped: number
  }
}

export type ReplayOptions = {
  from?: number            // timestamp >=
  to?: number              // timestamp <=
  actionKind?: Action['kind']
  chain?: ChainId
  onlyChanged?: boolean    // only include entries where outcome changed
  includeSimulation?: boolean  // pass original simulation to replay evaluator
}

// Minimal interface the replay engine needs from an audit log.
// @txfence/audit's AuditLog satisfies this structurally.
// Defined here to avoid circular dependency between core and audit.
export type ReplayableAuditLog = {
  query: (filter?: {
    from?: number
    to?: number
    actionKind?: Action['kind']
    chain?: ChainId
  }) => Promise<Array<{
    id: string
    timestamp: number
    action: Action
    evaluation: { passed: boolean; checksRun: string[]; rejectionReason?: string }
    simulation?: SimulationResult
    outcome: { status: string; [key: string]: unknown }
  }>>
}
