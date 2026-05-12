import type {
  Intent,
  IntentExecutionResult,
  IntentExecutionStatus,
  StepExecutionResult,
} from './types.js'
import type { Policy } from '../types/policy.js'
import type { ChainId } from '../types/policy.js'
import type { AdapterMap } from '../agent/adapter.js'
import type { CapLockProvider } from '../caps/provider.js'
import type { ApprovalProvider } from '../approval/types.js'
import type { ReceiptStore } from '../storage/store.js'
import type { TelemetryProvider } from '../telemetry/types.js'
import type { NotificationProvider } from '../notifications/types.js'
import type { SuccessReceipt, ExecutionFailureReason, PolicyEvaluation } from '../types/receipt.js'
import type { SimulationResult } from '../types/simulation.js'
import type { Action } from '../types/action.js'
import { runPipeline } from '../agent/pipeline.js'
import { getPoisonedSteps } from './graph.js'
import { analyzeIntentPosition } from './position.js'
import { evaluateIntent } from './evaluate.js'

type AuditLogLike = Parameters<typeof runPipeline>[9]

export type IntentExecutionOptions = {
  adapters: AdapterMap
  rpcUrls: Partial<Record<ChainId, string>>
  executor?: (
    action: Action,
    chainId: ChainId,
    rpcUrl: string,
    evaluation: PolicyEvaluation,
    simulation: SimulationResult,
  ) => Promise<SuccessReceipt>
  capLockProvider?: CapLockProvider
  approvalProvider?: ApprovalProvider
  receiptStore?: ReceiptStore
  auditLog?: AuditLogLike
  telemetryProvider?: TelemetryProvider
  notificationProvider?: NotificationProvider
}

export async function executeIntent(
  intent: Intent,
  txPolicy: Policy,
  options: IntentExecutionOptions,
): Promise<IntentExecutionResult> {
  const startedAt = Date.now()
  const maxDurationMs = intent.intentPolicy?.maxDurationMs

  // Step 1: Evaluate the intent before executing anything
  const evaluation = evaluateIntent(intent, txPolicy)
  if (!evaluation.passed) {
    const completedAt = Date.now()
    return {
      intentId: intent.id,
      status: 'rejected',
      stepResults: [],
      completedStepIds: [],
      failedStepIds: [],
      skippedStepIds: intent.steps.map(s => s.id),
      receipts: {},
      positionAnalysis: analyzeIntentPosition(intent.steps, []),
      intentEvaluation: evaluation,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
    }
  }

  const { executionPlan } = evaluation
  const stepMap = new Map(intent.steps.map(s => [s.id, s]))

  const stepResults: StepExecutionResult[] = []
  const receipts: Record<string, SuccessReceipt> = {}
  const completedStepIds: string[] = []
  const failedStepIds: string[] = []
  const skippedStepIds: string[] = []
  const poisonedSteps = new Set<string>()

  // Step 2: Execute each step in topological order
  for (const stepId of executionPlan) {
    const step = stepMap.get(stepId)
    if (step === undefined) continue

    // Check timeout before starting this step
    if (maxDurationMs !== undefined && Date.now() - startedAt > maxDurationMs) {
      for (const remainingId of executionPlan.slice(executionPlan.indexOf(stepId))) {
        const remainingStep = stepMap.get(remainingId)
        if (remainingStep !== undefined) {
          stepResults.push({ status: 'abandoned', stepId: remainingId, reason: 'timeout' })
          skippedStepIds.push(remainingId)
        }
      }
      break
    }

    // Check if poisoned by an upstream failure
    if (poisonedSteps.has(stepId)) {
      stepResults.push({ status: 'skipped', stepId, reason: 'upstream step failed' })
      skippedStepIds.push(stepId)
      continue
    }

    try {
      const result = await runPipeline(
        step.action,
        txPolicy,
        options.adapters,
        options.rpcUrls,
        options.executor,
        options.capLockProvider,
        undefined,
        options.approvalProvider,
        options.receiptStore,
        options.auditLog,
        options.telemetryProvider,
        undefined,
        options.notificationProvider,
        { intentId: intent.id, stepId: step.id },
      )

      if (result.status === 'success') {
        stepResults.push({ status: 'success', stepId, receipt: result.receipt })
        receipts[stepId] = result.receipt
        completedStepIds.push(stepId)
      } else {
        const failureReason: ExecutionFailureReason = result.status === 'execution_failed'
          ? result.reason
          : { code: 'executor_threw', message: result.status }
        stepResults.push({ status: 'failed', stepId, reason: failureReason })
        failedStepIds.push(stepId)
        if (step.optional !== true) {
          const newlyPoisoned = getPoisonedSteps(stepId, intent.steps)
          for (const pid of newlyPoisoned) poisonedSteps.add(pid)
        }
      }
    } catch (err) {
      const failureReason: ExecutionFailureReason = {
        code: 'executor_threw',
        message: err instanceof Error ? err.message : String(err),
        cause: err,
      }
      stepResults.push({ status: 'failed', stepId, reason: failureReason })
      failedStepIds.push(stepId)
      if (step.optional !== true) {
        const newlyPoisoned = getPoisonedSteps(stepId, intent.steps)
        for (const pid of newlyPoisoned) poisonedSteps.add(pid)
      }
    }
  }

  // Step 3: Determine overall status
  const requireAllSteps = intent.intentPolicy?.requireAllSteps !== false
  const hasAbandoned = stepResults.some(r => r.status === 'abandoned')
  const timedOut = maxDurationMs !== undefined && Date.now() - startedAt > maxDurationMs

  let status: IntentExecutionStatus
  if (hasAbandoned || timedOut) {
    status = 'timed_out'
  } else if (failedStepIds.length === 0) {
    status = 'completed'
  } else if (completedStepIds.length === 0) {
    status = 'failed'
  } else if (requireAllSteps) {
    status = 'partial'
  } else {
    status = 'completed'
  }

  const completedAt = Date.now()
  const positionAnalysis = analyzeIntentPosition(
    intent.steps.filter(s => completedStepIds.includes(s.id)),
    completedStepIds,
  )

  return {
    intentId: intent.id,
    status,
    stepResults,
    completedStepIds,
    failedStepIds,
    skippedStepIds,
    receipts,
    positionAnalysis,
    intentEvaluation: evaluation,
    startedAt,
    completedAt,
    durationMs: completedAt - startedAt,
  }
}
