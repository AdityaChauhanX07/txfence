import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runPipeline } from '@txfence/core'
import type { Policy, ChainId } from '@txfence/core'
import { executeEvmAction } from '@txfence/evm'
import type { TxfenceConfig } from '../config.js'
import { tokenAmountSchema, actionSchema, buildAction, bigintReplacer, textResult, errorResult } from './shared.js'

const policyOverridesSchema = z.object({
  maxSpendPerTx: tokenAmountSchema.optional(),
  requireSimulation: z.boolean().optional(),
  gasBufferMultiplier: z.number().optional(),
  humanApprovalThreshold: tokenAmountSchema.optional(),
  humanApprovalTimeoutMs: z.number().optional(),
}).optional()

function mergePolicy(base: Policy, overrides: z.output<typeof policyOverridesSchema>): Policy {
  if (overrides === undefined) return base

  const maxSpendAmount = overrides.maxSpendPerTx !== undefined
    ? (BigInt(overrides.maxSpendPerTx.amount) < base.maxSpendPerTx.amount
        ? BigInt(overrides.maxSpendPerTx.amount)
        : base.maxSpendPerTx.amount)
    : base.maxSpendPerTx.amount

  const humanApprovalAmount = overrides.humanApprovalThreshold !== undefined
    ? (BigInt(overrides.humanApprovalThreshold.amount) < base.humanApprovalThreshold.amount
        ? BigInt(overrides.humanApprovalThreshold.amount)
        : base.humanApprovalThreshold.amount)
    : base.humanApprovalThreshold.amount

  return {
    ...base,
    maxSpendPerTx: { ...base.maxSpendPerTx, amount: maxSpendAmount },
    humanApprovalThreshold: { ...base.humanApprovalThreshold, amount: humanApprovalAmount },
    requireSimulation: base.requireSimulation || (overrides.requireSimulation ?? false),
    gasBufferMultiplier: overrides.gasBufferMultiplier !== undefined
      ? Math.max(base.gasBufferMultiplier, overrides.gasBufferMultiplier)
      : base.gasBufferMultiplier,
    humanApprovalTimeoutMs: overrides.humanApprovalTimeoutMs !== undefined
      ? Math.min(base.humanApprovalTimeoutMs, overrides.humanApprovalTimeoutMs)
      : base.humanApprovalTimeoutMs,
  }
}

export function registerSubmitTool(server: McpServer, config: TxfenceConfig): void {
  server.tool(
    'txfence_submit',
    'Run the full txfence pipeline: policy check, simulation, approval threshold check, and optionally execution. dryRun defaults to true.',
    { action: actionSchema, dryRun: z.boolean().default(true), policyOverrides: policyOverridesSchema },
    async (args) => {
      const action = buildAction(args.action)
      const mergedPolicy = mergePolicy(config.policy, args.policyOverrides)

      if (args.dryRun) {
        const result = await runPipeline(action, mergedPolicy, config.adapters, config.rpcUrls)
        if (
          result.status === 'execution_failed' &&
          result.reason.code === 'no_executor'
        ) {
          return textResult(JSON.stringify(
            { ...result, reason: 'dry run complete — set dryRun: false to execute' },
            bigintReplacer, 2,
          ))
        }
        return textResult(JSON.stringify(result, bigintReplacer, 2))
      }

      const signer = config.signer
      if (signer === undefined) {
        return errorResult('no signer configured — set dryRun: true or configure a signer in txfence.config.ts')
      }

      const result = await runPipeline(
        action,
        mergedPolicy,
        config.adapters,
        config.rpcUrls,
        (act, chainId, rpcUrl, evaluation, simulation) =>
          executeEvmAction(act, chainId as ChainId, rpcUrl, signer, evaluation, simulation),
        config.capLockProvider,
        config.metadataVerifier,
      )
      return textResult(JSON.stringify(result, bigintReplacer, 2))
    },
  )
}
