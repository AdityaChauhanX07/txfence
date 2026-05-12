import { Command } from 'commander'
import { resolve } from 'path'
import { addActionOptions, buildActionFromOptions } from '../action-options.js'
import { loadConfig } from '@txfence/mcp'
import { runDryRun } from '@txfence/core'
import type { DryRunBlocker } from '@txfence/core'

export function makeDryRunCommand(): Command {
  const cmd = new Command('dry-run')
    .description('Run the full pipeline without executing — shows what would happen')
    .option('--config <path>', 'path to txfence.config.ts', './txfence.config.ts')

  addActionOptions(cmd)

  cmd.action(async (opts: Record<string, string>) => {
    try {
      const config = await loadConfig(resolve(opts['config'] ?? './txfence.config.ts'))
      const action = buildActionFromOptions(opts)

      const result = await runDryRun(
        action,
        config.policy,
        config.adapters,
        config.rpcUrls,
      )

      console.log('\n=== Dry Run Report ===\n')
      console.log(`Action:        ${action.kind} on ${action.chain}`)
      console.log(`Would proceed: ${result.wouldProceed ? 'YES' : 'NO'}`)
      console.log('')

      console.log('Policy evaluation:')
      console.log(`  Result:  ${result.evaluation.passed ? 'PASSED' : 'FAILED'}`)
      console.log(`  Checks:  ${result.evaluation.checksRun.join(', ')}`)
      if (result.evaluation.rejectionReason !== undefined) {
        console.log(`  Rejected: ${result.evaluation.rejectionReason}`)
      }

      if (result.simulation !== undefined) {
        console.log('')
        console.log('Simulation:')
        console.log(`  Success:  ${result.simulation.success}`)
        console.log(`  Coverage: ${result.simulation.coverageLevel}`)
        console.log(`  Gas est:  ${result.simulation.gasEstimate}`)
        if (result.simulation.caveats.length > 0) {
          console.log(`  Caveats:  ${result.simulation.caveats.join(', ')}`)
        }
      }

      console.log('')
      console.log(`Approval required: ${result.approvalRequired ? 'YES' : 'no'}`)
      if (result.approvalThreshold !== undefined) {
        console.log(`  Threshold: ${result.approvalThreshold.amount} ${result.approvalThreshold.token}`)
      }

      console.log(`Cap lock available: ${result.capLockAvailable ? 'yes' : 'NO'}`)

      if (result.blockers.length > 0) {
        console.log('')
        console.log('Blockers:')
        for (const blocker of result.blockers) {
          console.log(`  ${formatBlocker(blocker)}`)
        }
      }

      console.log('')
      process.exit(result.wouldProceed ? 0 : 1)
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

  return cmd
}

function formatBlocker(blocker: DryRunBlocker): string {
  switch (blocker.kind) {
    case 'policy_rejected':
      return `[BLOCKED] Policy rejected: ${blocker.reason}`
    case 'simulation_failed':
      return '[BLOCKED] Simulation failed'
    case 'simulation_stale':
      return `[BLOCKED] Simulation stale by ${blocker.stalenessMs}ms`
    case 'approval_required':
      return `[BLOCKED] Human approval required (threshold: ${blocker.thresholdAmount} ${blocker.thresholdToken})`
    case 'cap_lock_unavailable':
      return `[BLOCKED] Cap lock unavailable: ${blocker.capId}`
    default: {
      const _: never = blocker
      return ''
    }
  }
}
