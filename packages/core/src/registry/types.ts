// Chain-agnostic policy expression types.
// The registry maps human-readable identifiers (asset symbols, protocol names)
// to chain-specific contract addresses and token decimals.
// This lets policies reference "USDC on Ethereum" and "Uniswap V3 on Arbitrum"
// without hardcoding addresses — addresses are resolved at policy build time,
// not at evaluation time. The policy engine stays pure.

import type { ChainId } from '../types/policy.js'
import type { ContractEntry } from '../types/policy.js'

export type AssetDefinition = {
  symbol: string
  chain: ChainId
  address: string
  decimals: number
  coingeckoId?: string
}

export type ProtocolContractRole =
  | 'router'
  | 'factory'
  | 'quoter'
  | 'pool'
  | 'vault'
  | 'staking'
  | 'lending'
  | 'oracle'
  | 'other'

export type ProtocolContract = {
  address: string
  role: ProtocolContractRole
  description?: string
}

export type ProtocolDefinition = {
  id: string
  name: string
  chain: ChainId
  contracts: ProtocolContract[]
  website?: string
}

export type Registry = {
  // Asset lookup
  getAsset: (symbol: string, chain: ChainId) => AssetDefinition | undefined
  listAssets: (chain?: ChainId) => AssetDefinition[]

  // Protocol lookup
  getProtocol: (id: string, chain: ChainId) => ProtocolDefinition | undefined
  listProtocols: (chain?: ChainId) => ProtocolDefinition[]

  // Registration (for custom entries)
  addAsset: (asset: AssetDefinition) => void
  addProtocol: (protocol: ProtocolDefinition) => void

  // Policy helpers
  asset: (symbol: string, chain: ChainId) => AssetDefinition
  // throws if not found

  protocol: (id: string, chains: ChainId | ChainId[]) => ContractEntry[]
  // returns ContractEntry[] ready to spread into allowedContracts
  // throws if not found on any requested chain

  maxSpend: (amount: bigint, symbol: string, chain: ChainId) => import('../types/policy.js').TokenAmount
  // resolves decimals from asset registry
  // throws if asset not found
}
