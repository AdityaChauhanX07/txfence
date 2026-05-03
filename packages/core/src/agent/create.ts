import type { AgentConfig, Agent } from '../types/agent.js'
import type { BoundAction } from '../types/action.js'
import type { ChainId } from '../types/policy.js'
import type { AdapterMap } from './adapter.js'
import { runPipeline } from './pipeline.js'

export function createAgent(
  config: AgentConfig,
  adapters: AdapterMap,
  rpcUrls: Partial<Record<ChainId, string>>,
): Agent {
  return {
    config,
    submit: (boundAction: BoundAction) =>
      runPipeline(boundAction.action, boundAction.policy, adapters, rpcUrls),
  }
}
