// Circuit breaker wrapper for ChainAdapter.
// Wraps simulation calls with circuit breaker logic.
// If the breaker is open, simulation returns immediately with success: false
// and coverageLevel: 'none' without making an RPC call.
// Only RPC/network errors trigger the breaker — simulation results where
// wouldRevert: true are not failures (the RPC worked, the tx would revert).
// Usage:
//   const breaker = createCircuitBreaker({ failureThreshold: 5 })
//   const protectedAdapters = {
//     ethereum: wrapAdapterWithCircuitBreaker(
//       { simulate: simulateEvmAction }, breaker, 'ethereum'
//     )
//   }
import type { ChainAdapter } from '../agent/adapter.js'
import type { CircuitBreaker } from './types.js'
import type { SimulationResult, SimulateOptions } from '../types/simulation.js'
import type { Action } from '../types/action.js'
import type { ChainId } from '../types/policy.js'

export function wrapAdapterWithCircuitBreaker(
  adapter: ChainAdapter,
  breaker: CircuitBreaker,
  _chainId: ChainId,
): ChainAdapter {
  return {
    simulate: async (
      action: Action,
      chain: ChainId,
      rpcUrl: string,
      options?: SimulateOptions,
    ): Promise<SimulationResult> => {
      if (breaker.isOpen()) {
        return {
          success: false,
          wouldRevert: false,
          chain,
          simulatedAtBlock: 0,
          gasEstimate: 0n,
          gasBufferApplied: 1.0,
          coverageLevel: 'none',
          caveats: [],
          provider: 'eth_call',
        }
      }

      try {
        const result = await adapter.simulate(action, chain, rpcUrl, options)
        if (result.success) {
          breaker.recordSuccess()
        } else {
          // Simulation ran but transaction would revert — not an RPC failure.
          // Do not record as circuit breaker failure.
        }
        return result
      } catch (err) {
        breaker.recordFailure()
        return {
          success: false,
          wouldRevert: false,
          chain,
          simulatedAtBlock: 0,
          gasEstimate: 0n,
          gasBufferApplied: 1.0,
          coverageLevel: 'none',
          caveats: [],
          provider: 'eth_call',
        }
      }
    },
  }
}
