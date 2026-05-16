import { useState, useCallback } from 'react'
import type { Action, Agent, Policy, DryRunResult } from '@txfence/core'

export type UseDryRunState = {
  result: DryRunResult | null
  loading: boolean
  error: string | null
}

export type UseDryRunReturn = UseDryRunState & {
  dryRun: (action: Action, policy: Policy) => Promise<void>
  reset: () => void
}

export function useDryRun(agent: Agent): UseDryRunReturn {
  const [state, setState] = useState<UseDryRunState>({
    result: null,
    loading: false,
    error: null,
  })

  const dryRun = useCallback(
    async (action: Action, policy: Policy) => {
      setState({ result: null, loading: true, error: null })
      try {
        const result = await agent.dryRun({ action, policy })
        setState({ result, loading: false, error: null })
      } catch (err) {
        setState({
          result: null,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [agent],
  )

  const reset = useCallback(() => {
    setState({ result: null, loading: false, error: null })
  }, [])

  return { ...state, dryRun, reset }
}
