import { Command } from 'commander'
import { resolve } from 'path'
import { loadConfig } from '@txfence/mcp'
import { createPolicyVersion } from '@txfence/core'

export function makePolicySnapshotCommand(): Command {
  const cmd = new Command('policy-snapshot')
    .description('Print the version ID and hash for the active policy config')
    .requiredOption('--config <path>', 'path to txfence config')
    .option('--label <label>', 'human-readable label for this version')
    .option('--author <author>', 'author of this version')
    .option('--json', 'output as JSON')

  cmd.action(async (opts: Record<string, unknown>) => {
    try {
      const config = await loadConfig(resolve(opts['config'] as string))
      const version = createPolicyVersion(config.policy, {
        ...(typeof opts['label'] === 'string' ? { label: opts['label'] } : {}),
        ...(typeof opts['author'] === 'string' ? { author: opts['author'] } : {}),
      })

      if (opts['json'] === true) {
        console.log(JSON.stringify({
          id: version.id,
          ...(version.label !== undefined ? { label: version.label } : {}),
          ...(version.author !== undefined ? { author: version.author } : {}),
          createdAt: version.createdAt,
          policy: {
            chains: version.policy.chains,
            maxSpendPerTx: {
              token: version.policy.maxSpendPerTx.token,
              amount: version.policy.maxSpendPerTx.amount.toString(),
              decimals: version.policy.maxSpendPerTx.decimals,
            },
            requireSimulation: version.policy.requireSimulation,
            gasBufferMultiplier: version.policy.gasBufferMultiplier,
            allowedContracts: version.policy.allowedContracts.length,
          },
        }, null, 2))
      } else {
        console.log('\n=== Policy Snapshot ===\n')
        console.log(`ID:      ${version.id}`)
        if (version.label !== undefined) console.log(`Label:   ${version.label}`)
        if (version.author !== undefined) console.log(`Author:  ${version.author}`)
        console.log(`Created: ${new Date(version.createdAt).toISOString()}`)
        console.log('')
        console.log('Policy summary:')
        console.log(`  Chains:              ${version.policy.chains.join(', ')}`)
        console.log(`  Max spend per tx:    ${version.policy.maxSpendPerTx.amount} ${version.policy.maxSpendPerTx.token}`)
        console.log(`  Require simulation:  ${version.policy.requireSimulation}`)
        console.log(`  Gas buffer:          ${version.policy.gasBufferMultiplier}x`)
        console.log(`  Allowed contracts:   ${version.policy.allowedContracts.length}`)
        console.log('')
        console.log('Use this ID to reference this policy version in audit queries.')
      }

      process.exit(0)
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

  return cmd
}
