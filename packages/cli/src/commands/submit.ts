import { Command } from 'commander'
import { resolve } from 'path'
import { addActionOptions, buildActionFromOptions } from '../action-options.js'
import { formatExecutionResult } from '../format.js'
import { loadConfig } from '@txfence/mcp'
import { runPipeline } from '@txfence/core'
import { executeEvmAction } from '@txfence/evm'

export function makeSubmitCommand(): Command {
  const cmd = new Command('submit')
    .description('Run the full txfence pipeline. Dry run by default.')
    .option('--config <path>', 'path to txfence.config.ts', './txfence.config.ts')
    .option('--dry-run', 'simulate the full pipeline without executing (default)', true)
    .option('--execute', 'execute the transaction (requires signer in config)')

  addActionOptions(cmd)

  cmd.action(async (opts: Record<string, string | boolean>) => {
    try {
      const config = await loadConfig(resolve((opts['config'] as string | undefined) ?? './txfence.config.ts'))
      const action = buildActionFromOptions(opts as Record<string, string>)
      const dryRun = !opts['execute']

      if (!dryRun && config.signer === undefined) {
        console.error('execution requires a signer configured in txfence.config.ts')
        process.exit(1)
      }

      const executor = dryRun
        ? undefined
        : (
            action: Parameters<typeof executeEvmAction>[0],
            chainId: Parameters<typeof executeEvmAction>[1],
            rpcUrl: Parameters<typeof executeEvmAction>[2],
            evaluation: Parameters<typeof executeEvmAction>[4],
            simulation: Parameters<typeof executeEvmAction>[5],
          ) => executeEvmAction(action, chainId, rpcUrl, config.signer!, evaluation, simulation)

      const result = await runPipeline(
        action,
        config.policy,
        config.adapters,
        config.rpcUrls,
        executor,
      )

      if (
        !dryRun &&
        result.status === 'execution_failed' &&
        result.reason.includes('not yet implemented')
      ) {
        console.error('signing not available for this chain')
        process.exit(1)
      }

      console.log(formatExecutionResult(result))
      process.exit(result.status === 'success' ? 0 : 1)
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

  return cmd
}
