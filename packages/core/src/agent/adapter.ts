import type { Action } from '../types/action.js'
import type { ChainId } from '../types/policy.js'
import type { SimulationResult, SimulateOptions } from '../types/simulation.js'

export type ChainAdapter = {
  simulate: (action: Action, chainId: ChainId, rpcUrl: string, options?: SimulateOptions) => Promise<SimulationResult>
}

export type AdapterMap = Partial<Record<ChainId, ChainAdapter>>
