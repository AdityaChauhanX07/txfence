// Solana compute unit estimation requires a fully signed transaction to simulate accurately.
// The current implementation uses rent exemption minimums as placeholder gas estimates.
// Real CU simulation will be added once the signing layer is implemented in the agent layer.

import { createSolanaRpc, address, lamports } from '@solana/kit'
import type { SimulationResult, SimulationCaveat, Action, ChainId } from '@txfence/core'
import { isSolanaChain } from './constants.js'

// address reserved for future use when constructing transaction messages in simulation
void address

const DEFAULT_CU_BUFFER = 1.2

const SOLANA_CAVEATS: SimulationCaveat[] = [
  'state_may_diverge',
  'compute_budget_estimated',
  'account_locking_not_guaranteed',
]

export async function simulateSolanaAction(
  action: Action,
  chainId: ChainId,
  rpcUrl: string,
): Promise<SimulationResult> {
  if (!isSolanaChain(chainId)) {
    throw new Error('chain not supported by Solana adapter')
  }

  const rpc = createSolanaRpc(rpcUrl)

  try {
    let gasEstimate: bigint

    if (action.kind === 'transfer') {
      // placeholder: real fee estimation requires a fully compiled transaction message
      gasEstimate = await rpc.getMinimumBalanceForRentExemption(0n).send()
    } else {
      // real compute unit estimation requires a signed transaction and will be implemented
      // with proper CU simulation in a future iteration
      gasEstimate = await rpc.getMinimumBalanceForRentExemption(0n).send()
    }

    const slot = await rpc.getSlot().send()

    return {
      success: true,
      chain: chainId,
      simulatedAtBlock: Number(slot),
      gasEstimate,
      gasBufferApplied: DEFAULT_CU_BUFFER,
      coverageLevel: 'partial',
      caveats: [...SOLANA_CAVEATS],
    }
  } catch {
    return {
      success: false,
      chain: chainId,
      simulatedAtBlock: 0,
      gasEstimate: lamports(0n),
      gasBufferApplied: 0,
      coverageLevel: 'none',
      caveats: [...SOLANA_CAVEATS],
    }
  }
}
