import { StargateClient } from '@cosmjs/stargate'
import type { SimulationResult, SimulationCaveat, Action, ChainId, SimulateOptions } from '@txfence/core'
import { isCosmosChain, COSMOS_CHAIN_CONFIGS } from './constants.js'

const DEFAULT_GAS_BUFFER = 1.3

const COSMOS_CAVEATS: SimulationCaveat[] = [
  'state_may_diverge',
  'compute_budget_estimated',
]

export async function simulateCosmosAction(
  action: Action,
  chainId: ChainId,
  rpcUrl: string,
  _options?: SimulateOptions,
): Promise<SimulationResult> {
  if (!isCosmosChain(chainId)) {
    throw new Error('chain not supported by Cosmos adapter: ' + chainId)
  }

  // Cosmos does not have a Tenderly equivalent. Provider field uses 'eth_call' as placeholder.
  const provider = 'eth_call' as const

  try {
    const client = await StargateClient.connect(rpcUrl)
    const height = await client.getHeight()

    if (action.kind === 'transfer') {
      // Cosmos simulate endpoint requires a signed transaction.
      // Using a conservative MsgSend gas estimate (80000) as a placeholder.
      // Real gas simulation requires a funded account with sequence number.
      // This will be improved when the signing layer is implemented.
      return {
        success: true,
        wouldRevert: false,
        chain: chainId,
        simulatedAtBlock: height,
        gasEstimate: 80000n,
        gasBufferApplied: DEFAULT_GAS_BUFFER,
        coverageLevel: 'partial',
        caveats: [...COSMOS_CAVEATS],
        provider,
      }
    }

    // SwapAction and ContractCallAction require pre-built transaction bytes
    if (action.cosmosTransaction !== undefined) {
      // pre-built transaction — using placeholder gas estimate
      return {
        success: true,
        wouldRevert: false,
        chain: chainId,
        simulatedAtBlock: height,
        gasEstimate: 200000n,
        gasBufferApplied: DEFAULT_GAS_BUFFER,
        coverageLevel: 'partial',
        caveats: [...COSMOS_CAVEATS],
        provider,
      }
    }

    throw new Error(
      'SwapAction and ContractCallAction on Cosmos require cosmosTransaction — ' +
      'build the transaction bytes using @cosmjs/stargate and pass them via cosmosTransaction field',
    )
  } catch {
    return {
      success: false,
      wouldRevert: false,
      chain: chainId,
      simulatedAtBlock: 0,
      gasEstimate: 0n,
      gasBufferApplied: 0,
      coverageLevel: 'none',
      caveats: [...COSMOS_CAVEATS],
      provider,
    }
  }
}

// Re-export for consumers that only import from this file
export { COSMOS_CHAIN_CONFIGS }
