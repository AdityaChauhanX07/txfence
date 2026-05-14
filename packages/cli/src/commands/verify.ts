import { Command } from 'commander'
import { resolve } from 'node:path'
import { loadConfig } from '@txfence/mcp'
import { verify } from '@txfence/verify'
import type {
  RollingWindowProperty,
  AbsoluteCapProperty,
  PolicyContainmentProperty,
} from '@txfence/verify'
import { bigintReplacer } from '@txfence/core'

export function makeVerifyCommand(): Command {
  const cmd = new Command('verify')
    .description('Verify policy invariants using bounded model checking')

  const rollingWindowCmd = new Command('rolling-window')
    .description(
      'Check whether N agents sharing a rolling window cap can collectively exceed it. ' +
        'Generates a concrete counterexample if the invariant is violated.',
    )
    .requiredOption('--config <path>', 'path to txfence config')
    .requiredOption('--agents <n>', 'number of concurrent agents to check')
    .requiredOption('--transactions <n>', 'max transactions per agent to check')
    .requiredOption('--cap <amount>', 'rolling window cap amount (integer)')
    .requiredOption('--window <ms>', 'rolling window duration in milliseconds')
    .requiredOption('--token <symbol>', 'token symbol (e.g. USDC)')
    .option('--json', 'output results as JSON')

  rollingWindowCmd.action(async (opts: Record<string, string>) => {
    try {
      const config = await loadConfig(resolve(opts['config']!))
      const maxSpendPerTx = config.policy.maxSpendPerTx.amount

      const property: RollingWindowProperty = {
        kind: 'rolling_window_saturation',
        agentCount: parseInt(opts['agents']!, 10),
        transactionsPerAgent: parseInt(opts['transactions']!, 10),
        windowMs: parseInt(opts['window']!, 10),
        capAmount: BigInt(opts['cap']!),
        token: opts['token']!,
        maxSpendPerTx,
      }

      console.log('\n=== Rolling Window Saturation Check ===\n')
      console.log(`Agents:           ${property.agentCount}`)
      console.log(`Tx per agent:     ${property.transactionsPerAgent}`)
      console.log(`Window:           ${property.windowMs}ms`)
      console.log(`Cap:              ${property.capAmount} ${property.token}`)
      console.log(`Max spend per tx: ${property.maxSpendPerTx} ${property.token}`)
      console.log('\nVerifying...')

      const result = verify(property)

      if (opts['json']) {
        console.log(JSON.stringify(result, bigintReplacer, 2))
        process.exit(result.status === 'violated' ? 1 : 0)
      }

      printResult(result)
      process.exit(result.status === 'violated' ? 1 : 0)
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

  const absoluteCapCmd = new Command('absolute-cap')
    .description(
      'Check whether N agents can collectively reach or exceed the absolute cap. ' +
        'Produces a minimal counterexample showing how few transactions are needed.',
    )
    .requiredOption('--config <path>', 'path to txfence config')
    .requiredOption('--agents <n>', 'number of concurrent agents to check')
    .requiredOption('--transactions <n>', 'max transactions per agent to check')
    .requiredOption('--cap <amount>', 'absolute cap amount (integer)')
    .requiredOption('--token <symbol>', 'token symbol (e.g. USDC)')
    .option('--json', 'output results as JSON')

  absoluteCapCmd.action(async (opts: Record<string, string>) => {
    try {
      const config = await loadConfig(resolve(opts['config']!))
      const maxSpendPerTx = config.policy.maxSpendPerTx.amount

      const property: AbsoluteCapProperty = {
        kind: 'absolute_cap_reachability',
        agentCount: parseInt(opts['agents']!, 10),
        transactionsPerAgent: parseInt(opts['transactions']!, 10),
        capAmount: BigInt(opts['cap']!),
        token: opts['token']!,
        maxSpendPerTx,
      }

      console.log('\n=== Absolute Cap Reachability Check ===\n')
      console.log(`Agents:           ${property.agentCount}`)
      console.log(`Tx per agent:     ${property.transactionsPerAgent}`)
      console.log(`Cap:              ${property.capAmount} ${property.token}`)
      console.log(`Max spend per tx: ${property.maxSpendPerTx} ${property.token}`)
      console.log('\nVerifying...')

      const result = verify(property)

      if (opts['json']) {
        console.log(JSON.stringify(result, bigintReplacer, 2))
        process.exit(result.status === 'violated' ? 1 : 0)
      }

      printResult(result)
      process.exit(result.status === 'violated' ? 1 : 0)
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

  const policyContainsCmd = new Command('policy-contains')
    .description(
      'Check whether every action allowed by the inner policy is also allowed by the outer policy. ' +
        'Finds concrete actions that inner allows but outer rejects.',
    )
    .requiredOption('--inner <path>', 'path to the inner (narrower) txfence config')
    .requiredOption('--outer <path>', 'path to the outer (wider) txfence config')
    .option('--json', 'output results as JSON')

  policyContainsCmd.action(async (opts: Record<string, string>) => {
    try {
      const innerConfig = await loadConfig(resolve(opts['inner']!))
      const outerConfig = await loadConfig(resolve(opts['outer']!))

      const property: PolicyContainmentProperty = {
        kind: 'policy_containment',
        innerPolicy: innerConfig.policy,
        outerPolicy: outerConfig.policy,
      }

      console.log('\n=== Policy Containment Check ===\n')
      console.log(`Inner policy: ${opts['inner']}`)
      console.log(`Outer policy: ${opts['outer']}`)
      console.log('\nVerifying...')

      const result = verify(property)

      if (opts['json']) {
        console.log(JSON.stringify(result, bigintReplacer, 2))
        process.exit(result.status === 'violated' ? 1 : 0)
      }

      printResult(result)
      process.exit(result.status === 'violated' ? 1 : 0)
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

  cmd.addCommand(rollingWindowCmd)
  cmd.addCommand(absoluteCapCmd)
  cmd.addCommand(policyContainsCmd)

  return cmd
}

function printResult(result: ReturnType<typeof verify>): void {
  console.log('')
  if (result.status === 'holds') {
    console.log(`✓ HOLDS — ${result.property}`)
    console.log(`  Checked: ${result.scenariosChecked} scenario(s)`)
    console.log(
      `  Bound:   ${result.checkedBound.agentCount} agents, ` +
        `${result.checkedBound.transactionsPerAgent} tx/agent` +
        (result.checkedBound.windowMs !== undefined
          ? `, ${result.checkedBound.windowMs}ms window`
          : ''),
    )
    console.log(`  Time:    ${result.durationMs}ms`)
    console.log('')
    console.log('The invariant holds within the checked bound.')
    console.log('Increase --agents and --transactions to check larger bounds.')
  } else if (result.status === 'violated') {
    console.log(`✗ VIOLATED — ${result.property}`)
    console.log(`  Time: ${result.durationMs}ms`)
    console.log('')
    console.log('Counterexample:')
    console.log(`  ${result.counterExample.description}`)
    console.log('')
    console.log(`  Violated at transaction: ${result.counterExample.violatedAt}`)
    console.log(`  Violated amount:         ${result.counterExample.violatedAmount}`)
    console.log(`  Cap limit:               ${result.counterExample.capLimit}`)
    console.log('')
    console.log(
      `  Transactions in counterexample: ${result.counterExample.transactions.length}`,
    )
    const preview = result.counterExample.transactions.slice(0, 5)
    for (const tx of preview) {
      console.log(`    ${tx.agentId} — ${tx.amount} at t=${tx.timestamp}ms`)
    }
    if (result.counterExample.transactions.length > 5) {
      console.log(
        `    ... and ${result.counterExample.transactions.length - 5} more`,
      )
    }
  }
}
