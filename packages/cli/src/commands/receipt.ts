import { Command } from 'commander'
import { resolve } from 'path'
import { createPublicClient, http } from 'viem'
import { getViemChain } from '@txfence/evm'
import { loadConfig } from '@txfence/mcp'
import type { ChainId } from '@txfence/core'

export function makeReceiptCommand(): Command {
  const cmd = new Command('receipt')
    .description('Retrieve on-chain details for a transaction by hash')
    .option('--config <path>', 'path to txfence.config.ts', './txfence.config.ts')
    .requiredOption('--hash <txHash>', 'transaction hash')
    .requiredOption('--chain <chain>', 'chain the transaction was submitted to')
    .option('--rpc <url>', 'RPC endpoint override')

  cmd.action(async (opts: Record<string, string>) => {
    try {
      const config = await loadConfig(resolve(opts['config'] ?? './txfence.config.ts'))
      const rpcUrl = opts['rpc'] ?? config.rpcUrls[opts['chain'] as ChainId]
      if (rpcUrl === undefined) {
        console.error('no rpcUrl for chain: ' + opts['chain'])
        process.exit(1)
      }

      let chain
      try {
        chain = getViemChain(opts['chain'] as ChainId)
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }

      const client = createPublicClient({ chain, transport: http(rpcUrl) })
      const receipt = await client.getTransactionReceipt({ hash: opts['hash'] as `0x${string}` })

      console.log(`Transaction: ${opts['hash']}`)
      console.log(`Chain:       ${opts['chain']}`)
      console.log(`Status:      ${receipt.status}`)
      console.log(`Block:       ${receipt.blockNumber.toString()}`)
      console.log(`Gas used:    ${receipt.gasUsed.toString()}`)
      process.exit(0)
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

  return cmd
}
