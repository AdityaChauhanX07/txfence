import type { AssetDefinition, ProtocolDefinition, Registry } from './types.js'
import type { ChainId, ContractEntry, TokenAmount } from '../types/policy.js'
import { BUILT_IN_ASSETS } from './assets.js'
import { BUILT_IN_PROTOCOLS } from './protocols.js'

export function createRegistry(
  initialAssets: AssetDefinition[] = BUILT_IN_ASSETS,
  initialProtocols: ProtocolDefinition[] = BUILT_IN_PROTOCOLS,
): Registry {
  const assets: AssetDefinition[] = [...initialAssets]
  const protocols: ProtocolDefinition[] = [...initialProtocols]

  function getAsset(symbol: string, chain: ChainId): AssetDefinition | undefined {
    return assets.find(
      a => a.symbol.toUpperCase() === symbol.toUpperCase() && a.chain === chain
    )
  }

  function listAssets(chain?: ChainId): AssetDefinition[] {
    if (chain !== undefined) return assets.filter(a => a.chain === chain)
    return [...assets]
  }

  function getProtocol(id: string, chain: ChainId): ProtocolDefinition | undefined {
    return protocols.find(p => p.id === id && p.chain === chain)
  }

  function listProtocols(chain?: ChainId): ProtocolDefinition[] {
    if (chain !== undefined) return protocols.filter(p => p.chain === chain)
    return [...protocols]
  }

  function addAsset(assetDef: AssetDefinition): void {
    const idx = assets.findIndex(
      a => a.symbol.toUpperCase() === assetDef.symbol.toUpperCase() && a.chain === assetDef.chain
    )
    if (idx >= 0) {
      assets[idx] = assetDef
    } else {
      assets.push(assetDef)
    }
  }

  function addProtocol(protocol: ProtocolDefinition): void {
    const idx = protocols.findIndex(
      p => p.id === protocol.id && p.chain === protocol.chain
    )
    if (idx >= 0) {
      protocols[idx] = protocol
    } else {
      protocols.push(protocol)
    }
  }

  function asset(symbol: string, chain: ChainId): AssetDefinition {
    const found = getAsset(symbol, chain)
    if (found === undefined) {
      throw new Error(
        `Asset '${symbol}' not found on chain '${chain}'. ` +
        `Check the symbol spelling or add it with registry.addAsset().`
      )
    }
    return found
  }

  function protocol(id: string, chains: ChainId | ChainId[]): ContractEntry[] {
    const chainList = Array.isArray(chains) ? chains : [chains]
    const entries: ContractEntry[] = []

    for (const chain of chainList) {
      const proto = getProtocol(id, chain)
      if (proto === undefined) {
        throw new Error(
          `Protocol '${id}' not found on chain '${chain}'. ` +
          `Check the protocol ID or add it with registry.addProtocol().`
        )
      }
      for (const contract of proto.contracts) {
        entries.push({ address: contract.address, chain })
      }
    }

    return entries
  }

  function maxSpend(amount: bigint, symbol: string, chain: ChainId): TokenAmount {
    const assetDef = asset(symbol, chain)
    return { token: assetDef.symbol, amount, decimals: assetDef.decimals }
  }

  return {
    getAsset, listAssets,
    getProtocol, listProtocols,
    addAsset, addProtocol,
    asset, protocol, maxSpend,
  }
}

export const defaultRegistry: Registry = createRegistry()
