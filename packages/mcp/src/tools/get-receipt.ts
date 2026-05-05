import { z } from 'zod'
import { createPublicClient, http } from 'viem'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ChainId } from '@txfence/core'
import { getViemChain } from '@txfence/evm'
import type { TxfenceConfig } from '../config.js'
import { bigintReplacer, textResult, errorResult } from './shared.js'

export function registerGetReceiptTool(server: McpServer, config: TxfenceConfig): void {
  server.tool(
    'txfence_get_receipt',
    'Retrieve on-chain details for a previously submitted transaction by hash.',
    { txHash: z.string(), chain: z.string(), rpcUrl: z.string().optional() },
    async (args) => {
      const rpcUrl = args.rpcUrl ?? config.rpcUrls[args.chain as ChainId]
      if (rpcUrl === undefined) {
        return errorResult('no rpcUrl configured for chain: ' + args.chain)
      }

      let chain
      try {
        chain = getViemChain(args.chain as ChainId)
      } catch {
        return errorResult('chain not supported: ' + args.chain)
      }

      const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
      const receipt = await publicClient.getTransactionReceipt({
        hash: args.txHash as `0x${string}`,
      })

      return textResult(JSON.stringify({
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        status: receipt.status,
      }, bigintReplacer, 2))
    },
  )
}
