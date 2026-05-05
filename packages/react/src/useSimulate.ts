import { useState, useCallback } from 'react'
import type { Action, ChainId, SimulationResult, AdapterMap } from '@txfence/core'

export type UseSimulateState = {
  result: SimulationResult | null
  loading: boolean
  error: string | null
}

export type UseSimulateReturn = UseSimulateState & {
  simulate: (action: Action, rpcUrl?: string) => Promise<void>
  reset: () => void
}

export function useSimulate(
  adapters: AdapterMap,
  rpcUrls: Partial<Record<ChainId, string>>,
): UseSimulateReturn {
  const [state, setState] = useState<UseSimulateState>({
    result: null,
    loading: false,
    error: null,
  })

  const simulate = useCallback(
    async (action: Action, rpcUrl?: string) => {
      setState({ result: null, loading: true, error: null })

      const adapter = adapters[action.chain as ChainId]
      if (adapter === undefined) {
        setState({ result: null, loading: false, error: 'no adapter for chain: ' + action.chain })
        return
      }

      const url = rpcUrl ?? rpcUrls[action.chain as ChainId]
      if (url === undefined) {
        setState({ result: null, loading: false, error: 'no rpcUrl for chain: ' + action.chain })
        return
      }

      try {
        const result = await adapter.simulate(action, action.chain as ChainId, url)
        setState({ result, loading: false, error: null })
      } catch (err) {
        setState({
          result: null,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [adapters, rpcUrls],
  )

  const reset = useCallback(() => {
    setState({ result: null, loading: false, error: null })
  }, [])

  return { ...state, simulate, reset }
}
