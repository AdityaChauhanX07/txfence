import { useState, useEffect } from 'react'
import type { Agent, AgentHealth } from '@txfence/core'

export type UseAgentHealthOptions = {
  pollIntervalMs?: number
}

export function useAgentHealth(
  agent: Agent,
  options?: UseAgentHealthOptions,
): AgentHealth {
  const pollIntervalMs = options?.pollIntervalMs ?? 5000

  const [health, setHealth] = useState<AgentHealth>(() => agent.health())

  useEffect(() => {
    setHealth(agent.health())
    const id = setInterval(() => {
      setHealth(agent.health())
    }, pollIntervalMs)
    return () => clearInterval(id)
  }, [agent, pollIntervalMs])

  return health
}
