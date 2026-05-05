import type { ChainId, TokenAmount } from './policy.js'

export type SimulationCoverageLevel =
  | 'deep'      // Tenderly trace, implementation verified where applicable
  | 'basic'     // eth_call only, standard coverage
  | 'partial'   // eth_call with known gaps (kept for backward compat)
  | 'none'      // simulation failed or was not run

export type SimulationCaveat =
  | 'state_may_diverge'
  | 'proxy_implementation_unverified'
  | 'compute_budget_estimated'
  | 'account_locking_not_guaranteed'

export type SimulationProvider = 'eth_call' | 'tenderly'

export type TenderlyTrace = {
  callTrace: unknown
  stateDiff: unknown
  logs: unknown[]
  gasUsed: number
}

export type SimulateOptions = {
  stateOverrides?: Record<string, {
    balance?: bigint
    nonce?: number
  }>
}

export type SimulationResult = {
  success: boolean
  wouldRevert: boolean
  revertReason?: string
  chain: ChainId
  simulatedAtBlock: number
  gasEstimate: bigint
  gasBufferApplied: number
  expectedOutput?: TokenAmount
  coverageLevel: SimulationCoverageLevel
  caveats: SimulationCaveat[]
  provider: SimulationProvider
  trace?: TenderlyTrace
}
