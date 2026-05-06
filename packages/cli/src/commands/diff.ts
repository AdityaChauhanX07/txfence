import { Command } from 'commander'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { loadConfig } from '@txfence/mcp'
import { diffPolicies, createTestActions } from '@txfence/core'
import type { Action } from '@txfence/core'

export function makeDiffCommand(): Command {
  const cmd = new Command('diff')
    .description('Compare two policy configurations and show which actions are affected')
    .requiredOption('--config-a <path>', 'path to the current txfence config')
    .requiredOption('--config-b <path>', 'path to the proposed txfence config')
    .option('--actions-file <path>', 'JSON file containing actions to test (array of Action objects)')
    .option('--generate-actions', 'auto-generate test actions from policy A')

  cmd.action(async (opts: Record<string, string>) => {
    try {
      const configA = await loadConfig(resolve(opts['configA']!))
      const configB = await loadConfig(resolve(opts['configB']!))

      let actions: Array<{ action: Action }> = []

      if (opts['actionsFile'] !== undefined) {
        const filePath = opts['actionsFile']
        const raw = JSON.parse(readFileSync(resolve(filePath), 'utf-8')) as unknown
        if (!Array.isArray(raw)) {
          console.error('actions file must be a JSON array')
          process.exit(1)
        }
        actions = (raw as unknown[]).map(a => ({ action: a as Action }))
      } else if (opts['generateActions'] !== undefined) {
        actions = createTestActions(configA.policy)
      } else {
        console.error('provide --actions-file or --generate-actions')
        process.exit(1)
      }

      const diff = diffPolicies({
        policyA: configA.policy,
        policyB: configB.policy,
        actions,
      })

      console.log('\nPolicy Diff Summary')
      console.log('===================')
      console.log(`Total actions tested:        ${diff.summary.total}`)
      console.log(`Changed:                     ${diff.summary.changed}`)
      console.log(`  Newly allowed:             ${diff.summary.newlyAllowed}`)
      console.log(`  Newly rejected:            ${diff.summary.newlyRejected}`)
      console.log(`  Rejection reason changed:  ${diff.summary.rejectionReasonChanged}`)
      console.log(`Unchanged:                   ${diff.summary.unchanged}`)

      if (diff.summary.requiresSimulation > 0) {
        console.log(
          `\nWARNING: ${diff.summary.requiresSimulation} action(s) have simulation-dependent checks that were skipped (no simulationResult provided)`,
        )
      }

      if (diff.summary.changed === 0) {
        console.log('\nNo changes detected.')
        process.exit(0)
      }

      console.log('\nChanged Actions')
      console.log('===============')

      for (const result of diff.results.filter(r => r.changed)) {
        const act = result.action
        const actionDesc =
          act.kind === 'transfer'
            ? `transfer ${act.token.amount} ${act.token.token} on ${act.chain}`
            : act.kind === 'swap'
            ? `swap ${act.from.amount} ${act.from.token} on ${act.chain}`
            : `contract_call ${act.contract} on ${act.chain}`

        console.log(`\n[${result.direction?.toUpperCase()}] ${actionDesc}`)
        console.log(
          `  Policy A: ${result.evaluationA.passed ? 'PASSED' : `REJECTED (${result.evaluationA.rejectionReason})`}`,
        )
        console.log(
          `  Policy B: ${result.evaluationB.passed ? 'PASSED' : `REJECTED (${result.evaluationB.rejectionReason})`}`,
        )
        if (result.changedChecks.length > 0) {
          console.log(`  Changed checks: ${result.changedChecks.map(c => c.checkName).join(', ')}`)
        }
      }

      process.exit(diff.summary.newlyRejected > 0 ? 1 : 0)
      // exit 1 if actions are newly rejected — lets CI detect breaking policy changes
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

  return cmd
}
