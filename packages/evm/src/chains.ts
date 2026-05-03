import type { Chain } from 'viem'
import type { ChainId } from '@txfence/core'
import { mainnet, arbitrum, optimism, base } from 'viem/chains'

export const viemChains: Record<string, Chain> = {
  ethereum: mainnet,
  arbitrum: arbitrum,
  optimism: optimism,
  base: base,
}

export function getViemChain(chainId: ChainId): Chain {
  const chain = viemChains[chainId]
  if (chain === undefined) {
    throw new Error(`chain not supported by EVM adapter: ${chainId}`)
  }
  return chain
}
