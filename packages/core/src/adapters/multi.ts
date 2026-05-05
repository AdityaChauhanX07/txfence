import type { AdapterMap, ChainAdapter } from '../agent/adapter.js'
import type { ChainId } from '../types/policy.js'
import type { Action } from '../types/action.js'
import type { SimulationResult, SimulateOptions } from '../types/simulation.js'

export function createMultiChainAdapter(adapters: AdapterMap): ChainAdapter {
  return {
    async simulate(action: Action, chainId: ChainId, rpcUrl: string, options?: SimulateOptions): Promise<SimulationResult> {
      const adapter = adapters[chainId]
      if (adapter === undefined) {
        throw new Error(
          `no adapter registered for chain "${chainId}". ` +
          `Registered chains: ${Object.keys(adapters).join(', ') || 'none'}. ` +
          `Pass an adapter for "${chainId}" in your AdapterMap.`,
        )
      }
      return adapter.simulate(action, chainId, rpcUrl, options)
    },
  }
}
