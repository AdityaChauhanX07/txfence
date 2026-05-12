import type {
  Intent,
  IntentPolicy,
  IntentEvaluationResult,
  IntentPolicyEvaluationResult,
  StepEvaluationResult,
  IntentRejectionReason,
} from './types.js'
import type { Policy } from '../types/policy.js'
import type { SimulationResult } from '../types/simulation.js'
import type { BoundAction } from '../types/action.js'
import { validateIntentGraph, checkMaxSteps } from './graph.js'
import { analyzeIntentPosition, isSingleTokenIntent } from './position.js'
import { evaluate } from '../engine/evaluate.js'

export function evaluateIntent(
  intent: Intent,
  txPolicy: Policy,
  simulationResults?: Record<string, SimulationResult>,
): IntentEvaluationResult {
  const checksRun: string[] = []

  // Step 1: Validate the graph structure
  const graphResult = validateIntentGraph(intent)
  if (!graphResult.valid) {
    return {
      passed: false,
      intentId: intent.id,
      stepEvaluations: [],
      executionPlan: [],
      rejectionReason: graphResult.reason,
    }
  }

  const { executionPlan } = graphResult

  // Step 2: Check maxSteps
  checksRun.push('checkMaxSteps')
  if (!checkMaxSteps(intent)) {
    return {
      passed: false,
      intentId: intent.id,
      stepEvaluations: [],
      executionPlan,
      rejectionReason: 'too_many_steps',
      intentPolicyEvaluation: {
        passed: false,
        rejectionReason: 'too_many_steps',
        positionAnalysis: analyzeIntentPosition(intent.steps, executionPlan),
        checksRun,
      },
    }
  }

  // Step 3: Check allowedChains
  if (intent.intentPolicy?.allowedChains !== undefined) {
    checksRun.push('checkAllowedChains')
    for (const step of intent.steps) {
      if (!intent.intentPolicy.allowedChains.includes(step.action.chain)) {
        return {
          passed: false,
          intentId: intent.id,
          stepEvaluations: [],
          executionPlan,
          rejectionReason: 'chain_not_allowed',
          intentPolicyEvaluation: {
            passed: false,
            rejectionReason: 'chain_not_allowed',
            positionAnalysis: analyzeIntentPosition(intent.steps, executionPlan),
            checksRun,
          },
        }
      }
    }
  }

  // Step 4: Evaluate each step against the per-tx policy
  const stepEvaluations: StepEvaluationResult[] = []
  let anyStepFailed = false

  for (const step of intent.steps) {
    const boundAction: BoundAction = { action: step.action, policy: txPolicy }
    const sim = simulationResults?.[step.id]
    const evaluation = evaluate(boundAction, sim)
    stepEvaluations.push({
      stepId: step.id,
      evaluation,
      skipped: false,
    })
    if (!evaluation.passed && step.optional !== true) {
      anyStepFailed = true
    }
  }

  if (anyStepFailed) {
    return {
      passed: false,
      intentId: intent.id,
      stepEvaluations,
      executionPlan,
      rejectionReason: 'step_policy_rejected',
      intentPolicyEvaluation: {
        passed: false,
        rejectionReason: 'step_policy_rejected',
        positionAnalysis: analyzeIntentPosition(intent.steps, executionPlan),
        checksRun: [...checksRun, 'checkStepPolicies'],
      },
    }
  }

  checksRun.push('checkStepPolicies')

  // Step 5: Position analysis and intent-level policy checks
  const positionAnalysis = analyzeIntentPosition(intent.steps, executionPlan)
  const intentPolicy = intent.intentPolicy

  if (intentPolicy === undefined) {
    return {
      passed: true,
      intentId: intent.id,
      stepEvaluations,
      executionPlan,
    }
  }

  // Check maxTotalGrossSpend (single-token only)
  if (intentPolicy.maxTotalGrossSpend !== undefined) {
    checksRun.push('checkMaxTotalGrossSpend')
    if (positionAnalysis.isSingleToken) {
      if (positionAnalysis.totalGrossOutflow > intentPolicy.maxTotalGrossSpend.amount) {
        return buildIntentPolicyRejection(
          intent.id, stepEvaluations, executionPlan,
          'total_gross_spend_exceeded', positionAnalysis, checksRun,
        )
      }
    }
  }

  // Check maxNetSpend (single-token only)
  if (intentPolicy.maxNetSpend !== undefined) {
    checksRun.push('checkMaxNetSpend')
    if (positionAnalysis.isSingleToken && positionAnalysis.dominantToken !== undefined) {
      const netChange = positionAnalysis.netChange.find(
        c => c.token === positionAnalysis.dominantToken,
      )
      const netOutflow = netChange !== undefined ? -netChange.amount : 0n
      if (netOutflow > intentPolicy.maxNetSpend.amount) {
        return buildIntentPolicyRejection(
          intent.id, stepEvaluations, executionPlan,
          'net_spend_exceeded', positionAnalysis, checksRun,
        )
      }
    }
  }

  // Check maxIntermediateExposure
  if (intentPolicy.maxIntermediateExposure !== undefined) {
    checksRun.push('checkMaxIntermediateExposure')
    if (positionAnalysis.maxIntermediateExposure > intentPolicy.maxIntermediateExposure.amount) {
      return buildIntentPolicyRejection(
        intent.id, stepEvaluations, executionPlan,
        'intermediate_exposure_exceeded', positionAnalysis, checksRun,
      )
    }
  }

  // All checks passed
  return {
    passed: true,
    intentId: intent.id,
    stepEvaluations,
    executionPlan,
    intentPolicyEvaluation: {
      passed: true,
      positionAnalysis,
      checksRun,
    },
  }
}

function buildIntentPolicyRejection(
  intentId: string,
  stepEvaluations: StepEvaluationResult[],
  executionPlan: string[],
  reason: IntentRejectionReason,
  positionAnalysis: ReturnType<typeof analyzeIntentPosition>,
  checksRun: string[],
): IntentEvaluationResult {
  return {
    passed: false,
    intentId,
    stepEvaluations,
    executionPlan,
    rejectionReason: reason,
    intentPolicyEvaluation: {
      passed: false,
      rejectionReason: reason,
      positionAnalysis,
      checksRun,
    },
  }
}
