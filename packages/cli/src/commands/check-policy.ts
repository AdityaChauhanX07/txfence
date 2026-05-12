import { Command } from 'commander'
import { resolve } from 'path'
import { addActionOptions, buildActionFromOptions } from '../action-options.js'
import { formatPolicyEvaluation } from '../format.js'
import { loadConfig } from '@txfence/mcp'
import { evaluate, validateConfig } from '@txfence/core'

export function makeCheckPolicyCommand(): Command {
  const cmd = new Command('check-policy')
    .description('Evaluate an action against the configured policy without simulation or execution')
    .option('--config <path>', 'path to txfence.config.ts', './txfence.config.ts')

  addActionOptions(cmd)

  cmd.action(async (opts: Record<string, string>) => {
    try {
      const config = await loadConfig(resolve(opts['config'] ?? './txfence.config.ts'))

      const validation = validateConfig(config.policy)

      if (validation.errors.length > 0) {
        console.error('\nPolicy configuration errors (must fix):')
        for (const err of validation.errors) {
          console.error(`  [ERROR] ${err.field}: ${err.message}`)
        }
      }

      if (validation.warnings.length > 0) {
        console.warn('\nPolicy configuration warnings (should fix):')
        for (const warn of validation.warnings) {
          console.warn(`  [WARN]  ${warn.field}: ${warn.message}`)
        }
      }

      if (!validation.valid) {
        console.error('\nPolicy has errors. Fix them before running agents.')
        process.exit(1)
      }

      if (validation.warnings.length > 0) {
        console.warn('')
      }

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
