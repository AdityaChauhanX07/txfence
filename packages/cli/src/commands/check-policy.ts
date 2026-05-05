import { Command } from 'commander'
import { resolve } from 'path'
import { addActionOptions, buildActionFromOptions } from '../action-options.js'
import { formatPolicyEvaluation } from '../format.js'
import { loadConfig } from '@txfence/mcp'
import { evaluate } from '@txfence/core'

export function makeCheckPolicyCommand(): Command {
  const cmd = new Command('check-policy')
    .description('Evaluate an action against the configured policy without simulation or execution')
    .option('--config <path>', 'path to txfence.config.ts', './txfence.config.ts')

  addActionOptions(cmd)

  cmd.action(async (opts: Record<string, string>) => {
    try {
      const config = await loadConfig(resolve(opts['config'] ?? './txfence.config.ts'))
      const action = buildActionFromOptions(opts)
      const boundAction = { action, policy: config.policy }
      const evaluation = evaluate(boundAction)
      console.log(formatPolicyEvaluation(evaluation))
      process.exit(evaluation.passed ? 0 : 1)
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

  return cmd
}
