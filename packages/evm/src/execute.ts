import { buildEvmTransaction } from './build.js'
import { broadcastAndConfirm } from './broadcast.js'
import type {
  Action,
  Signer,
  PolicyEvaluation,
  SimulationResult,
  SuccessReceipt,
  ChainId,
  MevProtectionMode,
  MevProtectionConfig,
} from '@txfence/core'

export async function executeEvmAction(
  action: Action,
  chainId: ChainId,
  rpcUrl: string,
  signer: Signer,
  evaluation: PolicyEvaluation,
  simulation: SimulationResult,
  mevProtection?: MevProtectionMode,
  mevConfig?: MevProtectionConfig,
): Promise<SuccessReceipt> {
  const serializedTx = await buildEvmTransaction(
    action,
    chainId,
    rpcUrl,
    simulation.gasEstimate,
    1.2,
    signer.address,
  )
  const signedTx = await signer.sign(serializedTx)
  return broadcastAndConfirm(
    signedTx,
    action,
    chainId,
    rpcUrl,
    evaluation,
    simulation,
    mevProtection,
    mevConfig,
  )
}
