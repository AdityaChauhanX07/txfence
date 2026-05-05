import { createPublicClient, http } from 'viem'
import type { SimulationResult, SimulationCaveat, SimulateOptions, Action, ChainId } from '@txfence/core'
import { getViemChain } from './chains.js'
import { simulateWithTenderly } from './tenderly.js'

export type TenderlyConfig = {
  accountSlug: string
  projectSlug: string
  accessKey: string
}

const PLACEHOLDER_FROM = '0x0000000000000000000000000000000000000001' as `0x${string}`
const DEFAULT_GAS_BUFFER = 1.2

export async function simulateEvmAction(
  action: Action,
  chainId: ChainId,
  rpcUrl: string,
  options?: SimulateOptions,
  tenderlyConfig?: TenderlyConfig,
): Promise<SimulationResult> {
  if (tenderlyConfig !== undefined) {
    return simulateWithTenderly(action, chainId, tenderlyConfig, options)
  }

  // throws 'chain not supported by EVM adapter: <id>' for non-EVM chains
  const chain = getViemChain(chainId)

  const client = createPublicClient({ chain, transport: http(rpcUrl) })

  try {
    let gasEstimate: bigint

    if (action.kind === 'swap') {
      // DEX routers revert on any call without valid swap calldata, so estimateGas
      // is not meaningful here. Use a conservative upper bound for a typical DEX swap.
      gasEstimate = 200_000n
    } else if (action.kind === 'transfer') {
      gasEstimate = await client.estimateGas({
        account: PLACEHOLDER_FROM,
        to: action.to as `0x${string}`,
        value: action.token.amount,
      })
    } else {
      gasEstimate = await client.estimateGas({
        account: PLACEHOLDER_FROM,
        to: action.contract as `0x${string}`,
        value: 0n,
      })
    }

    const blockNumber = await client.getBlockNumber()

    const caveats: SimulationCaveat[] = ['state_may_diverge']
    if (action.kind === 'swap') {
      caveats.push('proxy_implementation_unverified')
    }

    return {
      success: true,
      wouldRevert: false,
      chain: chainId,
      simulatedAtBlock: Number(blockNumber),
      gasEstimate,
      gasBufferApplied: DEFAULT_GAS_BUFFER,
      coverageLevel: 'basic',
      caveats,
      provider: 'eth_call',
    }
  } catch {
    return {
      success: false,
      wouldRevert: false,
      chain: chainId,
      simulatedAtBlock: 0,
      gasEstimate: 0n,
      gasBufferApplied: 0,
      coverageLevel: 'none',
      caveats: ['state_may_diverge'],
      provider: 'eth_call',
    }
  }
}
