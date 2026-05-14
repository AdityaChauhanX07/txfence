import { Command } from 'commander'
import { resolve } from 'node:path'
import { loadConfig } from '@txfence/mcp'
import { stressTest, DEFAULT_VECTORS } from '@txfence/verify'
import type {
  StressTestConfig,
  AttackVector,
  RiskReport,
} from '@txfence/verify'
import { bigintReplacer } from '@txfence/core'

type StressTestOpts = {
  config: string
  agents: string
  transactions: string
  jitter: string
  vectors?: string
  timeout: string
  json?: boolean
  onlyFailures?: boolean
}

export function makeStressTestCommand(): Command {
  const cmd = new Command('stress-test')
    .description(
      'Run thousands of adversarial scenarios against a policy configuration. ' +
        'Produces a risk report showing which attack vectors your policy survives.',
    )
    .requiredOption('--config <path>', 'path to txfence config')
    .option('--agents <n>', 'number of concurrent agents to simulate', '10')
    .option('--transactions <n>', 'transactions per scenario', '20')
    .option('--jitter <ms>', 'max timing jitter in milliseconds', '50')
    .option(
      '--vectors <list>',
      'comma-separated attack vectors to test: rapid_fire,coordinated_drain,rpc_failure,stale_simulation,cap_boundary,approval_flood',
    )
    .option('--timeout <ms>', 'per-scenario timeout in milliseconds', '5000')
    .option('--json', 'output results as JSON')
    .option('--only-failures', 'only show failed scenarios in output')

  cmd.action(async (opts: StressTestOpts) => {
    try {
      const config = await loadConfig(resolve(opts.config))

      const vectors: AttackVector[] | undefined =
        opts.vectors !== undefined
          ? opts.vectors.split(',').map((v: string) => v.trim() as AttackVector)
          : undefined

      const stressConfig: StressTestConfig = {
        agentCount: parseInt(opts.agents, 10),
        transactionsPerScenario: parseInt(opts.transactions, 10),
        timingJitterMs: parseInt(opts.jitter, 10),
        timeoutMs: parseInt(opts.timeout, 10),
        ...(vectors !== undefined ? { vectors } : {}),
      }

      if (opts.json !== true) {
        console.log('\n=== Policy Stress Test ===\n')
        console.log(`Config:       ${opts.config}`)
        console.log(`Agents:       ${stressConfig.agentCount}`)
        console.log(`Tx/scenario:  ${stressConfig.transactionsPerScenario}`)
        console.log(`Timing jitter: ${stressConfig.timingJitterMs}ms`)
        console.log(`Vectors:      ${(vectors ?? DEFAULT_VECTORS).join(', ')}`)
        console.log('\nRunning adversarial scenarios...')
      }

      const report = await stressTest(config.policy, stressConfig)

      if (opts.json === true) {
        console.log(JSON.stringify(report, bigintReplacer, 2))
        process.exit(report.failed > 0 ? 1 : 0)
      }

      printRiskReport(report, opts.onlyFailures === true)
      process.exit(report.failed > 0 ? 1 : 0)
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

  return cmd
}

function printRiskReport(report: RiskReport, onlyFailures: boolean): void {
  console.log('\n=== Risk Report ===\n')

  const pct = (report.survivalRate * 100).toFixed(1)
  const statusIcon = report.failed === 0 ? '✓' : '✗'

  console.log(
    `${statusIcon} Survival rate: ${pct}% (${report.survived}/${report.totalScenarios} scenarios)`,
  )
  console.log(`  Duration:     ${report.durationMs}ms`)
  console.log('')

  console.log('Results by attack vector:')
  for (const [vector, stats] of Object.entries(report.byVector)) {
    const failPct =
      stats.total > 0 ? ((stats.failed / stats.total) * 100).toFixed(0) : '0'
    const icon = stats.failed === 0 ? '✓' : '✗'
    console.log(
      `  ${icon} ${vector.padEnd(20)} ${stats.failed}/${stats.total} failed (${failPct}%)`,
    )
  }
  console.log('')

  if (report.failed > 0) {
    console.log('Failures by severity:')
    const severityOrder = ['critical', 'high', 'medium', 'low'] as const
    for (const severity of severityOrder) {
      const count = report.bySeverity[severity] ?? 0
      if (count > 0) {
        const icon = severity === 'critical' || severity === 'high' ? '⚠' : '!'
        console.log(`  ${icon} ${severity.padEnd(10)} ${count} scenario(s)`)
      }
    }
    console.log('')
  }

  if (report.failed > 0) {
    console.log(`Failed scenarios (${report.failed}):`)
    for (const scenario of report.failedScenarios) {
      console.log(
        `\n  [${scenario.severity.toUpperCase()}] ${scenario.vector} — ${scenario.description}`,
      )
      console.log(`    Outcome: ${scenario.outcome}`)
      console.log(`    Details: ${scenario.details}`)
      console.log(`    Time:    ${scenario.durationMs}ms`)
    }
    console.log('')
  } else if (!onlyFailures) {
    console.log('All scenarios passed — no failures detected.')
    console.log('')
  }

  console.log('Recommendation:')
  const lines = report.recommendation.split('\n\n')
  for (const line of lines) {
    console.log(`  ${line}`)
    if (lines.length > 1) console.log('')
  }
}
