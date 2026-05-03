import { createSolanaRpc } from '@solana/kit'
import type { SuccessReceipt, Action, PolicyEvaluation, SimulationResult, ChainId } from '@txfence/core'
import type { SolanaSerializedTransaction } from './build.js'

export async function broadcastAndConfirmSolana(
  signedTx: Uint8Array,
  action: Action,
  chainId: ChainId,
  rpcUrl: string,
  evaluation: PolicyEvaluation,
  simulation: SimulationResult,
): Promise<SuccessReceipt> {
  const rpc = createSolanaRpc(rpcUrl)

  // Encode the signed wire-format bytes as base64 for the JSON-RPC transport.
  // The RPC expects a Base64EncodedWireTransaction branded string; we cast because
  // we construct the wire format manually following the Solana spec (compact-u16 +
  // signatures + compiled message), producing the same bytes as getBase64EncodedWireTransaction.
  //
  // Access Node.js Buffer via globalThis to avoid requiring @types/node in this package.
  type NodeBuffer = { from(b: Uint8Array): { toString(encoding: string): string } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const NodeBuffer = (globalThis as any)['Buffer'] as NodeBuffer
  const base64Tx = NodeBuffer.from(signedTx).toString('base64')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txSig = await rpc.sendTransaction(base64Tx as any, {
    encoding: 'base64',
    skipPreflight: false,
  }).send()

  // Poll until the transaction reaches 'confirmed' or 'finalized' status (max 30 s)
  const maxAttempts = 30
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 1000))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { value: statuses } = await rpc.getSignatureStatuses([txSig] as any).send()
    const confirmed = statuses.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s !== null && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized'),
    )
    if (confirmed) break
  }

  const slot = await rpc.getSlot().send()

  return {
    status: 'success',
    action,
    policyEvaluation: evaluation,
    simulation,
    txHash: String(txSig),
    confirmedAtBlock: Number(slot),
    confirmedAtMs: Date.now(),
    // Solana does not expose gasUsed per-transaction in the same way as EVM;
    // use the simulation gas estimate as the closest available approximation
    gasUsed: simulation.gasEstimate,
  }
}

// Re-export SolanaSerializedTransaction so broadcast callers can reference it
export type { SolanaSerializedTransaction }
