import { createPublicClient, http } from 'viem'
import { getViemChain } from '@txfence/evm'
import type { ChainId, ReorgEvent } from './types.js'
import type { ReceiptStore } from '@txfence/core'

export async function reconcileReceipts(
  chain: ChainId,
  rpcUrl: string,
  receiptStore: ReceiptStore,
  lookbackBlocks?: number,
  onReorgDetected?: (event: ReorgEvent) => void,
): Promise<void> {
  const lookback = lookbackBlocks ?? 100
  const viemChain = getViemChain(chain)
  const publicClient = createPublicClient({ chain: viemChain, transport: http(rpcUrl) })

  const currentBlock = Number(await publicClient.getBlockNumber())
  const receipts = await receiptStore.list({
    chain,
    from: currentBlock - lookback,
  })

  for (const receipt of receipts) {
    try {
      const onChain = await publicClient.getTransactionReceipt({
        hash: receipt.txHash as `0x${string}`,
      })

      // Block number mismatch indicates the transaction was
      // re-mined in a different block after a chain reorganization
      if (Number(onChain.blockNumber) !== receipt.confirmedAtBlock) {
        onReorgDetected?.({
          chain,
          txHash: receipt.txHash,
          originalBlock: receipt.confirmedAtBlock,
          detectedAt: Date.now(),
        })
      }
    } catch {
      onReorgDetected?.({
        chain,
        txHash: receipt.txHash,
        originalBlock: receipt.confirmedAtBlock,
        detectedAt: Date.now(),
      })
    }
  }
}
