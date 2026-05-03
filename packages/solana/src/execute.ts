import { buildSolanaTransaction } from './build.js'
import { broadcastAndConfirmSolana } from './broadcast.js'
import type { SolanaSigner } from './signers.js'
import type { Action, PolicyEvaluation, SimulationResult, SuccessReceipt, ChainId } from '@txfence/core'

export async function executeSolanaAction(
  action: Action,
  chainId: ChainId,
  rpcUrl: string,
  signer: SolanaSigner,
  evaluation: PolicyEvaluation,
  simulation: SimulationResult,
): Promise<SuccessReceipt> {
  const serializedTx = await buildSolanaTransaction(action, chainId, rpcUrl, signer.address)
  const signedBytes = await signer.sign(serializedTx)
  return broadcastAndConfirmSolana(signedBytes, action, chainId, rpcUrl, evaluation, simulation)
}
