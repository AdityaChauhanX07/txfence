export const COSMOS_CHAIN_IDS = ['cosmoshub', 'osmosis'] as const

export type CosmosChainId = typeof COSMOS_CHAIN_IDS[number]

export function isCosmosChain(chainId: string): chainId is CosmosChainId {
  return (COSMOS_CHAIN_IDS as readonly string[]).includes(chainId)
}

export type CosmosChainConfig = {
  chainId: string       // actual Cosmos chain ID string e.g. 'cosmoshub-4'
  denom: string         // native denom e.g. 'uatom'
  bech32Prefix: string  // address prefix e.g. 'cosmos'
  gasPrice: string      // e.g. '0.025uatom'
}

export const COSMOS_CHAIN_CONFIGS: Record<CosmosChainId, CosmosChainConfig> = {
  cosmoshub: {
    chainId: 'cosmoshub-4',
    denom: 'uatom',
    bech32Prefix: 'cosmos',
    gasPrice: '0.025uatom',
  },
  osmosis: {
    chainId: 'osmosis-1',
    denom: 'uosmo',
    bech32Prefix: 'osmo',
    gasPrice: '0.025uosmo',
  },
}
