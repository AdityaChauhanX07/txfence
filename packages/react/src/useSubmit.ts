import { useState, useCallback } from 'react'
import type { Action, BoundAction, ExecutionResult, Agent, Policy } from '@txfence/core'

export type UseSubmitState = {
  result: ExecutionResult | null
  loading: boolean
  error: string | null
}

export type UseSubmitReturn = UseSubmitState & {
  submit: (action: Action, policy: Policy) => Promise<void>
  reset: () => void
}

export function useSubmit(agent: Agent): UseSubmitReturn {
  const [state, setState] = useState<UseSubmitState>({
    result: null,
    loading: false,
    error: null,
  })

  const submit = useCallback(
    async (action: Action, policy: Policy) => {
      setState({ result: null, loading: true, error: null })
      const boundAction: BoundAction = { action, policy }
      try {
        const result = await agent.submit(boundAction)
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

  return { ...state, submit, reset }
}
