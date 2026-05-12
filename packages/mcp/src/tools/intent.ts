import { z } from 'zod'
import {
  executeIntent,
  evaluateIntent,
  validateIntentGraph,
  formatExecutionFailureReason,
} from '@txfence/core'
import type { Intent, IntentStep, IntentPolicy, ChainId } from '@txfence/core'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { bigintReplacer, textResult } from './shared.js'
import type { TxfenceConfig } from '../config.js'

void bigintReplacer // imported per spec; reserved for future JSON serialization needs

const tokenAmountSchema = z.object({
  token: z.string(),
  amount: z.string().describe('amount as integer string (bigint)'),
  decimals: z.number().int(),
})

const intentActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('transfer'),
    chain: z.string(),
    token: tokenAmountSchema,
    to: z.string(),
  }),
  z.object({
    kind: z.literal('swap'),
    chain: z.string(),
    from: tokenAmountSchema,
    to: z.string(),
    via: z.string(),
    maxSlippage: z.number().int(),
  }),
  z.object({
    kind: z.literal('contract_call'),
    chain: z.string(),
    contract: z.string(),
    method: z.string(),
    args: z.array(z.unknown()),
    value: tokenAmountSchema.optional(),
  }),
])

const intentStepSchema = z.object({
  id: z.string(),
  action: intentActionSchema,
  dependsOn: z.array(z.string()).optional(),
  optional: z.boolean().optional(),
  label: z.string().optional(),
})

const intentPolicySchema = z.object({
  maxTotalGrossSpend: tokenAmountSchema.optional(),
  maxNetSpend: tokenAmountSchema.optional(),
  maxIntermediateExposure: tokenAmountSchema.optional(),
  maxSteps: z.number().int().optional(),
  requireAllSteps: z.boolean().optional(),
  maxDurationMs: z.number().int().optional(),
  allowedChains: z.array(z.string()).optional(),
})

const intentSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  steps: z.array(intentStepSchema),
  intentPolicy: intentPolicySchema.optional(),
})

function reviveTokenAmount(ta: { token: string; amount: string; decimals: number }) {
  return { token: ta.token, amount: BigInt(ta.amount), decimals: ta.decimals }
}

function buildIntentFromSchema(raw: z.infer<typeof intentSchema>): Intent {
  const steps: IntentStep[] = raw.steps.map(step => {
    const chain = step.action.chain as ChainId
    const action = (() => {
      switch (step.action.kind) {
        case 'transfer':
          return {
            kind: 'transfer' as const,
            chain,
            token: reviveTokenAmount(step.action.token),
            to: step.action.to,
          }
        case 'swap':
          return {
            kind: 'swap' as const,
            chain,
            from: reviveTokenAmount(step.action.from),
            to: step.action.to,
            via: step.action.via,
            maxSlippage: step.action.maxSlippage,
          }
        case 'contract_call': {
          const base = {
            kind: 'contract_call' as const,
            chain,
            contract: step.action.contract,
            method: step.action.method,
            args: step.action.args,
          }
          return step.action.value !== undefined
            ? { ...base, value: reviveTokenAmount(step.action.value) }
            : base
        }
      }
    })()
    return {
      id: step.id,
      action,
      ...(step.dependsOn !== undefined ? { dependsOn: step.dependsOn } : {}),
      ...(step.optional !== undefined ? { optional: step.optional } : {}),
      ...(step.label !== undefined ? { label: step.label } : {}),
    }
  })

  const intentPolicy: IntentPolicy | undefined = raw.intentPolicy !== undefined
    ? {
        ...(raw.intentPolicy.maxTotalGrossSpend !== undefined
          ? { maxTotalGrossSpend: reviveTokenAmount(raw.intentPolicy.maxTotalGrossSpend) }
          : {}),
        ...(raw.intentPolicy.maxNetSpend !== undefined
          ? { maxNetSpend: reviveTokenAmount(raw.intentPolicy.maxNetSpend) }
          : {}),
        ...(raw.intentPolicy.maxIntermediateExposure !== undefined
          ? { maxIntermediateExposure: reviveTokenAmount(raw.intentPolicy.maxIntermediateExposure) }
          : {}),
        ...(raw.intentPolicy.maxSteps !== undefined
          ? { maxSteps: raw.intentPolicy.maxSteps }
          : {}),
        ...(raw.intentPolicy.requireAllSteps !== undefined
          ? { requireAllSteps: raw.intentPolicy.requireAllSteps }
          : {}),
        ...(raw.intentPolicy.maxDurationMs !== undefined
          ? { maxDurationMs: raw.intentPolicy.maxDurationMs }
          : {}),
        ...(raw.intentPolicy.allowedChains !== undefined
          ? { allowedChains: raw.intentPolicy.allowedChains as ChainId[] }
          : {}),
      }
    : undefined

  return {
    id: raw.id,
    ...(raw.label !== undefined ? { label: raw.label } : {}),
    steps,
    ...(intentPolicy !== undefined ? { intentPolicy } : {}),
  }
}

export function registerIntentTools(server: McpServer, config: TxfenceConfig): void {
  server.tool(
    'txfence_validate_intent',
    'Validate an intent before execution — checks the dependency graph for cycles and missing references, evaluates each step against the configured policy, and returns position analysis showing total gross spend and intermediate exposure. Use this before txfence_execute_intent to check for problems.',
    { intent: intentSchema },
    async (input) => {
      const intent = buildIntentFromSchema(input.intent)

      const graphResult = validateIntentGraph(intent)
      if (!graphResult.valid) {
        return textResult(JSON.stringify({
          valid: false,
          graphError: { reason: graphResult.reason, detail: graphResult.detail },
        }, null, 2))
      }

      const evalResult = evaluateIntent(intent, config.policy)

      return textResult(JSON.stringify({
        valid: evalResult.passed,
        intentId: intent.id,
        executionPlan: evalResult.executionPlan,
        rejectionReason: evalResult.rejectionReason,
        stepEvaluations: evalResult.stepEvaluations.map(s => ({
          stepId: s.stepId,
          passed: s.evaluation.passed,
          rejectionReason: s.evaluation.rejectionReason,
        })),
        positionAnalysis: evalResult.intentPolicyEvaluation?.positionAnalysis
          ? {
              isSingleToken: evalResult.intentPolicyEvaluation.positionAnalysis.isSingleToken,
              dominantToken: evalResult.intentPolicyEvaluation.positionAnalysis.dominantToken,
              totalGrossOutflow: evalResult.intentPolicyEvaluation.positionAnalysis.totalGrossOutflow.toString(),
              maxIntermediateExposure: evalResult.intentPolicyEvaluation.positionAnalysis.maxIntermediateExposure.toString(),
            }
          : null,
      }, null, 2))
    },
  )

  server.tool(
    'txfence_execute_intent',
    'Execute a multi-step intent — runs all steps in dependency order, handles partial failures, and returns a detailed execution report. Steps that depend on failed steps are automatically skipped. Use txfence_validate_intent first to check for problems before executing.',
    {
      intent: intentSchema,
      dryRun: z.boolean().default(true).describe('Default true — set to false to actually execute'),
    },
    async (input) => {
      const intent = buildIntentFromSchema(input.intent)

      if (input.dryRun) {
        const evalResult = evaluateIntent(intent, config.policy)
        return textResult(JSON.stringify({
          dryRun: true,
          intentId: intent.id,
          wouldProceed: evalResult.passed,
          executionPlan: evalResult.executionPlan,
          rejectionReason: evalResult.rejectionReason,
          stepCount: intent.steps.length,
        }, null, 2))
      }

      const result = await executeIntent(intent, config.policy, {
        adapters: config.adapters ?? {},
        rpcUrls: config.rpcUrls ?? {},
        ...(config.executor !== undefined ? { executor: config.executor } : {}),
      })

      return textResult(JSON.stringify({
        intentId: result.intentId,
        status: result.status,
        durationMs: result.durationMs,
        completedSteps: result.completedStepIds,
        failedSteps: result.failedStepIds.map(stepId => {
          const stepResult = result.stepResults.find(r => r.stepId === stepId)
          return {
            stepId,
            reason: stepResult?.status === 'failed'
              ? formatExecutionFailureReason(stepResult.reason)
              : 'unknown',
          }
        }),
        skippedSteps: result.skippedStepIds,
        receipts: Object.fromEntries(
          Object.entries(result.receipts).map(([stepId, receipt]) => [
            stepId,
            { txHash: receipt.txHash, confirmedAtBlock: receipt.confirmedAtBlock },
          ])
        ),
        positionAnalysis: {
          totalGrossOutflow: result.positionAnalysis.totalGrossOutflow.toString(),
          isSingleToken: result.positionAnalysis.isSingleToken,
          dominantToken: result.positionAnalysis.dominantToken,
        },
      }, null, 2))
    },
  )
}
