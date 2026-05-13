import { Command } from 'commander'
import { resolve } from 'node:path'
import { loadConfig } from '@txfence/mcp'
import { replayAuditLog, bigintReplacer } from '@txfence/core'
import type { ReplayOptions, Action, ChainId } from '@txfence/core'
import { createFileAuditLog } from '@txfence/audit'

export function makeReplayCommand(): Command {
  const cmd = new Command('replay')
    .description('Replay historical audit log entries against a new policy — shows what would have changed')
    .requiredOption('--audit-log <path>', 'path to the audit log JSONL file')
    .requiredOption('--config <path>', 'path to the proposed txfence config to test against')
    .option('--from <timestamp>', 'replay entries from this timestamp (ms since epoch)')
    .option('--to <timestamp>', 'replay entries up to this timestamp (ms since epoch)')
    .option('--kind <kind>', 'filter by action kind: transfer, swap, or contract_call')
    .option('--chain <chain>', 'filter by chain')
    .option('--only-changed', 'only show entries where outcome changed', false)
    .option('--json', 'output results as JSON')

  cmd.action(async (opts: Record<string, string | boolean | undefined>) => {
    try {
      const config = await loadConfig(resolve(opts['config'] as string))
      const auditLog = createFileAuditLog(resolve(opts['auditLog'] as string))

      const fromOpt = opts['from'] as string | undefined
      const toOpt = opts['to'] as string | undefined
      const kindOpt = opts['kind'] as Action['kind'] | undefined
      const chainOpt = opts['chain'] as ChainId | undefined
      const onlyChanged = opts['onlyChanged'] === true

      const replayOptions: ReplayOptions = {
        ...(fromOpt !== undefined ? { from: parseInt(fromOpt, 10) } : {}),
        ...(toOpt !== undefined ? { to: parseInt(toOpt, 10) } : {}),
        ...(kindOpt !== undefined ? { actionKind: kindOpt } : {}),
        ...(chainOpt !== undefined ? { chain: chainOpt } : {}),
        ...(onlyChanged ? { onlyChanged: true } : {}),
      }

      console.log('\n=== Policy Replay ===\n')
      console.log(`Audit log: ${opts['auditLog']}`)
      console.log(`Policy:    ${opts['config']}`)
      if (fromOpt !== undefined) console.log(`From:      ${new Date(parseInt(fromOpt, 10)).toISOString()}`)
      if (toOpt !== undefined) console.log(`To:        ${new Date(parseInt(toOpt, 10)).toISOString()}`)
      console.log('\nReplaying...')

      const result = await replayAuditLog(auditLog, config.policy, replayOptions)

      if (opts['json'] === true) {
        console.log(JSON.stringify(result, bigintReplacer, 2))
        process.exit(result.summary.newlyRejected > 0 ? 1 : 0)
        return
      }

      console.log('\n=== Summary ===\n')
      console.log(`Total entries:             ${result.summary.total}`)
      console.log(`Unchanged:                 ${result.summary.unchanged}`)
      console.log(`Changed:                   ${result.summary.changed}`)
      console.log(`  Newly allowed:           ${result.summary.newlyAllowed}`)
      console.log(`  Newly rejected:          ${result.summary.newlyRejected}`)
      console.log(`  Rejection reason changed: ${result.summary.rejectionReasonChanged}`)
      if (result.summary.skipped > 0) {
        console.log(`Skipped (no eval data):    ${result.summary.skipped}`)
      }

      if (result.summary.changed === 0) {
        console.log('\nNo changes — this policy would have produced identical outcomes.')
        process.exit(0)
      }

      console.log('\n=== Changed Entries ===\n')
      const changedEntries = result.entries.filter(e => e.changed)
      for (const entry of changedEntries) {
        const direction = entry.direction?.toUpperCase().replace(/_/g, ' ') ?? 'CHANGED'
        const ts = new Date(entry.timestamp).toISOString()
        const act = entry.action
        const actionDesc =
          act.kind === 'transfer'
            ? `transfer ${act.token.amount} ${act.token.token} on ${act.chain}`
            : act.kind === 'swap'
            ? `swap ${act.from.amount} ${act.from.token} on ${act.chain}`
            : `contract_call on ${act.chain}`

        console.log(`[${direction}] ${ts}`)
        console.log(`  ${actionDesc}`)
        console.log(`  Original: ${entry.originalEvaluation.passed ? 'PASSED' : `REJECTED (${entry.originalEvaluation.rejectionReason})`}`)
        console.log(`  Replay:   ${entry.replayEvaluation.passed ? 'PASSED' : `REJECTED (${entry.replayEvaluation.rejectionReason})`}`)
        if (entry.changedChecks.length > 0) {
          console.log(`  Changed checks: ${entry.changedChecks.map(c => c.checkName).join(', ')}`)
        }
        console.log()
      }

      process.exit(result.summary.newlyRejected > 0 ? 1 : 0)
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

  return cmd
}
