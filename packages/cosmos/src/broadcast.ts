import { StargateClient } from '@cosmjs/stargate'
import type { SuccessReceipt, Action, PolicyEvaluation, SimulationResult, ChainId } from '@txfence/core'
import { isCosmosChain } from './constants.js'

export async function broadcastAndConfirmCosmos(
  signedTx: Uint8Array,
  action: Action,
  chainId: ChainId,
  rpcUrl: string,
  evaluation: PolicyEvaluation,
  simulation: SimulationResult,
): Promise<SuccessReceipt> {
  if (!isCosmosChain(chainId)) {
    throw new Error('chain not supported by Cosmos adapter: ' + chainId)
  }

  const client = await StargateClient.connect(rpcUrl)
  const result = await client.broadcastTx(signedTx)

  if (result.code !== 0) {
    throw new Error('transaction failed: ' + (result.rawLog ?? 'unknown error'))
  }

  const height = await client.getHeight()

  return {
    status: 'success',
    action,
    policyEvaluation: evaluation,
    simulation,
    txHash: result.transactionHash,
    confirmedAtBlock: height,
    confirmedAtMs: Date.now(),
    gasUsed: BigInt(result.gasUsed),
  }
}
