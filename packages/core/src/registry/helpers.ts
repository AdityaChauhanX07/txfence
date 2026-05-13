// Top-level registry helpers — delegate to the default built-in registry.
// For custom protocols or assets, use createRegistry() and call the same
// methods on your own registry instance.
//
// Example:
//   import { protocol, asset, maxSpend } from '@txfence/core'
//
//   const policy: Policy = {
//     chains: ['ethereum', 'arbitrum'],
//     maxSpendPerTx: maxSpend(10_000n, 'USDC', 'ethereum'),
//     allowedContracts: [
//       ...protocol('uniswap-v3', ['ethereum', 'arbitrum']),
//       ...protocol('aave-v3', ['ethereum']),
//     ],
//     // ...
//   }

import { defaultRegistry } from './registry.js'
import type { ChainId, ContractEntry, TokenAmount } from '../types/policy.js'
import type { AssetDefinition, ProtocolDefinition } from './types.js'

export function asset(symbol: string, chain: ChainId): AssetDefinition {
  return defaultRegistry.asset(symbol, chain)
}

export function protocol(id: string, chains: ChainId | ChainId[]): ContractEntry[] {
  return defaultRegistry.protocol(id, chains)
}

export function maxSpend(amount: bigint, symbol: string, chain: ChainId): TokenAmount {
  return defaultRegistry.maxSpend(amount, symbol, chain)
}

export function getAsset(symbol: string, chain: ChainId): AssetDefinition | undefined {
  return defaultRegistry.getAsset(symbol, chain)
}

export function getProtocol(id: string, chain: ChainId): ProtocolDefinition | undefined {
  return defaultRegistry.getProtocol(id, chain)
}

export function listAssets(chain?: ChainId): AssetDefinition[] {
  return defaultRegistry.listAssets(chain)
}

export function listProtocols(chain?: ChainId): ProtocolDefinition[] {
  return defaultRegistry.listProtocols(chain)
}
