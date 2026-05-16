import { useState, useCallback } from 'react'
import type { Agent, Intent, IntentExecutionResult } from '@txfence/core'

export type UseIntentSubmitState = {
  result: IntentExecutionResult | null
  loading: boolean
  error: string | null
}

export type UseIntentSubmitReturn = UseIntentSubmitState & {
  executeIntent: (intent: Intent) => Promise<void>
  reset: () => void
}

export function useIntentSubmit(agent: Agent): UseIntentSubmitReturn {
  const [state, setState] = useState<UseIntentSubmitState>({
    result: null,
    loading: false,
    error: null,
  })

  const executeIntent = useCallback(
    async (intent: Intent) => {
      setState({ result: null, loading: true, error: null })
      try {
        const result = await agent.executeIntent(intent)
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

  return { ...state, executeIntent, reset }
}
