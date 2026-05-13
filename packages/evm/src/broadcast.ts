import { createPublicClient, http } from 'viem'
import type {
  SuccessReceipt,
  Action,
  PolicyEvaluation,
  SimulationResult,
  ChainId,
  MevProtectionMode,
  MevProtectionConfig,
} from '@txfence/core'
import { getViemChain } from './chains.js'
import { broadcastWithMevProtection } from './mev.js'

export async function broadcastAndConfirm(
  signedTx: `0x${string}`,
  action: Action,
  chainId: ChainId,
  rpcUrl: string,
  evaluation: PolicyEvaluation,
  simulation: SimulationResult,
  mevProtection?: MevProtectionMode,
  mevConfig?: MevProtectionConfig,
): Promise<SuccessReceipt> {
  const chain = getViemChain(chainId)
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })

  let txHash: `0x${string}`
  if (mevProtection !== undefined && mevProtection !== 'none') {
    const hash = await broadcastWithMevProtection(signedTx, mevProtection, mevConfig, rpcUrl)
    txHash = hash as `0x${string}`
  } else {
    txHash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx })
  }

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
