import type { Action } from '../types/action.js'
import type { ChainId, TokenAmount } from '../types/policy.js'
import type { PolicyEvaluation, ExecutionFailureReason, SuccessReceipt } from '../types/receipt.js'
import type { SimulationResult } from '../types/simulation.js'

// ── Intent graph types ───────────────────────────────────────────────────────

export type IntentStep = {
  id: string
  action: Action
  dependsOn?: string[]
  optional?: boolean
  label?: string
}

export type Intent = {
  id: string
  label?: string
  steps: IntentStep[]
  intentPolicy?: IntentPolicy
}

// ── Intent-level policy types ────────────────────────────────────────────────

export type IntentPolicy = {
  // Single-token constraints only in v1.
  // All amounts must be in the same token as the steps being evaluated.
  // Multi-token comparison requires a price oracle (planned for v2).

  maxTotalGrossSpend?: TokenAmount
  // Sum of all outflows across all steps.
  // Only enforced when all steps use the same spend token.

  maxNetSpend?: TokenAmount
  // Net position change (outflows minus inflows).
  // Only enforced when all steps use the same token.

  maxIntermediateExposure?: TokenAmount
  // Maximum value held at any single point during execution.
  // e.g. after swapping USDC→ETH but before staking, the ETH exposure.

  maxSteps?: number
  // Maximum number of steps in the intent.

  requireAllSteps?: boolean
  // Default true. If false, partial completion is acceptable.
  // If true, any required step failure aborts the intent.

  maxDurationMs?: number
  // Maximum wall-clock time the intent is allowed to run.
  // If exceeded, remaining steps are abandoned.

  allowedChains?: ChainId[]
  // Restrict which chains can appear in the intent.
  // If not set, inherits from the per-transaction Policy.
}

// ── Position analysis types ──────────────────────────────────────────────────

export type PositionChange = {
  token: string
  amount: bigint
  chain: ChainId
}

export type StepPositionSnapshot = {
  stepId: string
  positionChanges: PositionChange[]
  cumulativePosition: PositionChange[]
  grossOutflowSoFar: bigint
}

export type IntentPositionAnalysis = {
  steps: StepPositionSnapshot[]
  totalGrossOutflow: bigint
  netChange: PositionChange[]
  maxIntermediateExposure: bigint
  isSingleToken: boolean
  dominantToken?: string
}

// ── Evaluation types ─────────────────────────────────────────────────────────

export type IntentRejectionReason =
  | 'total_gross_spend_exceeded'
  | 'net_spend_exceeded'
  | 'intermediate_exposure_exceeded'
  | 'too_many_steps'
  | 'cyclic_dependency'
  | 'missing_dependency'
  | 'intent_duration_exceeded'
  | 'chain_not_allowed'
  | 'step_policy_rejected'

export type StepEvaluationResult = {
  stepId: string
  evaluation: PolicyEvaluation
  skipped: boolean
  skipReason?: string
}

export type IntentPolicyEvaluationResult = {
  passed: boolean
  rejectionReason?: IntentRejectionReason
  positionAnalysis: IntentPositionAnalysis
  checksRun: string[]
}

export type IntentEvaluationResult = {
  passed: boolean
  intentId: string
  stepEvaluations: StepEvaluationResult[]
  intentPolicyEvaluation?: IntentPolicyEvaluationResult
  executionPlan: string[]
  rejectionReason?: IntentRejectionReason
}

// ── Execution types ──────────────────────────────────────────────────────────

export type IntentExecutionStatus =
  | 'completed'
  | 'partial'
  | 'failed'
  | 'rejected'
  | 'timed_out'

export type StepExecutionResult =
  | { status: 'success'; stepId: string; receipt: SuccessReceipt }
  | { status: 'failed'; stepId: string; reason: ExecutionFailureReason }
  | { status: 'skipped'; stepId: string; reason: string }
  | { status: 'abandoned'; stepId: string; reason: 'timeout' }

export type IntentExecutionResult = {
  intentId: string
  status: IntentExecutionStatus
  stepResults: StepExecutionResult[]
  completedStepIds: string[]
  failedStepIds: string[]
  skippedStepIds: string[]
  receipts: Record<string, SuccessReceipt>
  positionAnalysis: IntentPositionAnalysis
  intentEvaluation: IntentEvaluationResult
  startedAt: number
  completedAt: number
  durationMs: number
}

