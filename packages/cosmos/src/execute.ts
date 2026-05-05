// Handles all three action kinds via buildCosmosTransaction:
//   TransferAction       -- requires cosmosTransaction bytes until native MsgSend is implemented
//   SwapAction           -- requires cosmosTransaction bytes (e.g. from Osmosis SDK)
//   ContractCallAction   -- requires cosmosTransaction bytes

import { buildCosmosTransaction } from './build.js'
import { broadcastAndConfirmCosmos } from './broadcast.js'
import type { CosmosSigner } from './signers.js'
import type { Action, PolicyEvaluation, SimulationResult, SuccessReceipt, ChainId } from '@txfence/core'

export async function executeCosmosAction(
  action: Action,
  chainId: ChainId,
  rpcUrl: string,
  signer: CosmosSigner,
  evaluation: PolicyEvaluation,
  simulation: SimulationResult,
): Promise<SuccessReceipt> {
  const serializedTx = await buildCosmosTransaction(action, chainId, rpcUrl, signer.address)
  const signedBytes = await signer.sign(serializedTx)
  return broadcastAndConfirmCosmos(signedBytes, action, chainId, rpcUrl, evaluation, simulation)
}
