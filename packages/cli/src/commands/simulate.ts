import { Command } from 'commander'
import { resolve } from 'path'
import { addActionOptions, buildActionFromOptions } from '../action-options.js'
import { formatSimulationResult } from '../format.js'
import { loadConfig } from '@txfence/mcp'
import type { ChainId } from '@txfence/core'

export function makeSimulateCommand(): Command {
  const cmd = new Command('simulate')
    .description('Simulate an on-chain action without executing it')
    .option('--config <path>', 'path to txfence.config.ts', './txfence.config.ts')
    .option('--rpc <url>', 'RPC endpoint override')

  addActionOptions(cmd)

  cmd.action(async (opts: Record<string, string>) => {
    try {
      const config = await loadConfig(resolve(opts['config'] ?? './txfence.config.ts'))
      const action = buildActionFromOptions(opts)
      const adapter = config.adapters[action.chain as ChainId]
      if (adapter === undefined) {
        throw new Error('no adapter for chain: ' + action.chain)
      }
      const rpcUrl = opts['rpc'] ?? config.rpcUrls[action.chain as ChainId]
      if (rpcUrl === undefined) {
        throw new Error('no rpcUrl for chain: ' + action.chain)
      }
      const result = await adapter.simulate(action, action.chain as ChainId, rpcUrl)
      console.log(formatSimulationResult(result))
      process.exit(0)
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

  return cmd
}
