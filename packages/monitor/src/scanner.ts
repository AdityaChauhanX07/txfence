import { createPublicClient, http } from 'viem'
import { getViemChain } from '@txfence/evm'
import type { ChainId } from './types.js'

// Block scanning fetches full transaction objects for every block.
// This is RPC-intensive. Use a dedicated RPC endpoint (Alchemy, Infura)
// rather than a public node in production. See README for guidance.

export async function scanBlockRange(
  chain: ChainId,
  fromBlock: number,
  toBlock: number,
  watchedAddresses: string[],
  rpcUrl: string,
): Promise<Array<{
  txHash: string
  fromAddress: string
  toAddress: string | null
  value: string
  blockNumber: number
}>> {
  const viemChain = getViemChain(chain)
  const publicClient = createPublicClient({ chain: viemChain, transport: http(rpcUrl) })
  const normalizedAddresses = watchedAddresses.map(a => a.toLowerCase())
  const results: Array<{
    txHash: string
    fromAddress: string
    toAddress: string | null
    value: string
    blockNumber: number
  }> = []

  for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
    const block = await publicClient.getBlock({
      blockNumber: BigInt(blockNum),
      includeTransactions: true,
    })

    for (const tx of block.transactions) {
      if (typeof tx === 'string') continue
      if (normalizedAddresses.includes(tx.from.toLowerCase())) {
        results.push({
          txHash: tx.hash,
          fromAddress: tx.from,
          toAddress: tx.to ?? null,
          value: tx.value.toString(),
          blockNumber: Number(block.number),
        })
      }
    }
  }

  return results
}
