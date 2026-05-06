import type { Action } from '../types/action.js'
import type { PolicyEvaluation, PolicyRejectionReason } from '../types/receipt.js'
import type { SimulationResult } from '../types/simulation.js'
import type { Policy } from '../types/policy.js'

export type ActionDiffDirection =
  | 'newly_allowed'
  | 'newly_rejected'
  | 'rejection_reason_changed'

export type ChangedCheck = {
  checkName: string
  inA: boolean
  inB: boolean
  rejectionReasonA?: PolicyRejectionReason
  rejectionReasonB?: PolicyRejectionReason
}

export type ActionDiffResult = {
  action: Action
  simulationResult?: SimulationResult
  evaluationA: PolicyEvaluation
  evaluationB: PolicyEvaluation
  changed: boolean
  direction?: ActionDiffDirection
  changedChecks: ChangedCheck[]
}

export type PolicyDiffInput = {
  policyA: Policy
  policyB: Policy
  actions: Array<{ action: Action; simulationResult?: SimulationResult }>
}

export type PolicyDiff = {
  policyA: Policy
  policyB: Policy
  results: ActionDiffResult[]
  summary: {
    total: number
    changed: number
    newlyAllowed: number
    newlyRejected: number
    rejectionReasonChanged: number
    unchanged: number
    requiresSimulation: number
  }
}
