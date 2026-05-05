import { useMemo } from 'react'
import { createAgent } from '@txfence/core'
import type {
  AgentConfig,
  AdapterMap,
  ChainId,
  SuccessReceipt,
  PolicyEvaluation,
  SimulationResult,
  CapLockProvider,
  MetadataVerifier,
  Agent,
  Action,
} from '@txfence/core'

export type UseAgentOptions = {
  config: AgentConfig
  adapters: AdapterMap
  rpcUrls: Partial<Record<ChainId, string>>
  executor?: (
    action: Action,
    chainId: ChainId,
    rpcUrl: string,
    evaluation: PolicyEvaluation,
    simulation: SimulationResult,
  ) => Promise<SuccessReceipt>
  capLockProvider?: CapLockProvider
  metadataVerifier?: MetadataVerifier
}

// agent is memoized with no deps — it is stable for the lifetime
// of the component. if config changes, remount the component or use a key prop.
export function useAgent(options: UseAgentOptions): Agent {
  return useMemo(
    () =>
      createAgent(
        options.config,
        options.adapters,
        options.rpcUrls,
        options.executor,
        options.capLockProvider,
        options.metadataVerifier,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
}
