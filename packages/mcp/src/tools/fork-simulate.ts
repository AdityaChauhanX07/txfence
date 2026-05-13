import { z } from 'zod'
import { simulateIntentOnFork } from '@txfence/evm'
import type { ForkSimulationConfig, ChainId } from '@txfence/core'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { textResult } from './shared.js'
import type { TxfenceConfig } from '../config.js'
import { intentSchema, buildIntentFromSchema } from './intent.js'

export function registerForkSimulateTool(server: McpServer, config: TxfenceConfig): void {
  server.tool(
    'txfence_fork_simulate_intent',
    'Simulate a multi-step intent on a forked chain state using Tenderly. Shows what the final position would look like after all steps execute, without actually executing anything. Requires TENDERLY_ACCESS_KEY, TENDERLY_ACCOUNT_SLUG, and TENDERLY_PROJECT_SLUG environment variables.',
    {
      intent: intentSchema,
      chain: z.string().describe('chain to fork (e.g. ethereum, base, arbitrum)'),
      fromAddress: z.string().describe('agent address for all simulated transactions'),
      blockNumber: z.number().int().optional().describe('block number to fork at (default: latest)'),
    },
    async (input) => {
      const tenderlyAccessKey = process.env.TENDERLY_ACCESS_KEY
      const tenderlyAccountSlug = process.env.TENDERLY_ACCOUNT_SLUG
      const tenderlyProjectSlug = process.env.TENDERLY_PROJECT_SLUG

      if (!tenderlyAccessKey || !tenderlyAccountSlug || !tenderlyProjectSlug) {
        return textResult(JSON.stringify({
          error: 'Fork simulation requires Tenderly credentials',
          required: ['TENDERLY_ACCESS_KEY', 'TENDERLY_ACCOUNT_SLUG', 'TENDERLY_PROJECT_SLUG'],
        }))
      }

      const intent = buildIntentFromSchema(input.intent)

      const forkConfig: ForkSimulationConfig = {
        provider: 'tenderly',
        tenderlyConfig: {
          accessKey: tenderlyAccessKey,
          accountSlug: tenderlyAccountSlug,
          projectSlug: tenderlyProjectSlug,
        },
        fromAddress: input.fromAddress,
        ...(input.blockNumber !== undefined ? { blockNumber: input.blockNumber } : {}),
      }

      const rpcUrl = config.rpcUrls?.[input.chain as ChainId]
      if (rpcUrl === undefined) {
        return textResult(JSON.stringify({
          error: `No RPC URL configured for chain ${input.chain}`,
        }))
      }

      try {
        const result = await simulateIntentOnFork(
          intent,
          forkConfig,
          input.chain as ChainId,
          rpcUrl,
        )

        return textResult(JSON.stringify({
          intentId: intent.id,
          chain: result.chain,
          forkedAtBlock: result.forkedAtBlock,
          wouldAllSucceed: result.wouldAllSucceed,
          failingStepId: result.failingStepId,
          steps: result.steps.map(s => ({
            stepId: s.stepId,
            wouldRevert: s.wouldRevert,
            revertReason: s.revertReason,
            gasUsed: s.simulation.gasEstimate.toString(),
            stateChanges: s.stateChanges.map(sc => ({
              address: sc.address,
              delta: sc.delta.toString(),
              balanceBefore: sc.balanceBefore.toString(),
              balanceAfter: sc.balanceAfter.toString(),
            })),
          })),
          finalPosition: result.finalPosition.map(p => ({
            token: p.token,
            chain: p.chain,
            amount: p.amount.toString(),
          })),
          simulatedAt: result.simulatedAt,
        }, null, 2))
      } catch (err) {
        return textResult(JSON.stringify({
          error: (err as Error).message,
        }))
      }
    },
  )
}
