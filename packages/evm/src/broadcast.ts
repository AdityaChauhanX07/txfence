import { createPublicClient, http } from 'viem'
import type { SuccessReceipt, Action, PolicyEvaluation, SimulationResult, ChainId } from '@txfence/core'
import { getViemChain } from './chains.js'

export async function broadcastAndConfirm(
  signedTx: `0x${string}`,
  action: Action,
  chainId: ChainId,
  rpcUrl: string,
  evaluation: PolicyEvaluation,
  simulation: SimulationResult,
): Promise<SuccessReceipt> {
  const chain = getViemChain(chainId)
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
  const txHash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx })
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  return {
    status: 'success',
    action,
    policyEvaluation: evaluation,
    simulation,
    txHash,
    confirmedAtBlock: Number(receipt.blockNumber),
    confirmedAtMs: Date.now(),
    gasUsed: receipt.gasUsed,
  }
}
