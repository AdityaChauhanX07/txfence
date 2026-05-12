import type { Action } from '../types/action.js'
import type { PolicyEvaluation, PolicyRejectionReason } from '../types/receipt.js'
import type { SimulationResult, SimulationCaveat } from '../types/simulation.js'

export type DryRunBlocker =
  | { kind: 'policy_rejected'; reason: PolicyRejectionReason }
  | { kind: 'simulation_failed'; caveats: SimulationCaveat[] }
  | { kind: 'simulation_stale'; stalenessMs: number }
  | { kind: 'approval_required'; thresholdAmount: bigint; thresholdToken: string }
  | { kind: 'cap_lock_unavailable'; capId: string }

export type DryRunResult = {
  action: Action
  evaluation: PolicyEvaluation
  simulation?: SimulationResult
  approvalRequired: boolean
  approvalThreshold?: { amount: bigint; token: string }
  capLockAvailable: boolean
  wouldProceed: boolean
  blockers: DryRunBlocker[]
  dryRunAt: number
}
