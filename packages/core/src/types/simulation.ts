import type { ChainId, TokenAmount } from './policy.js'

export type SimulationCoverageLevel =
  | 'full'
  | 'partial'
  | 'none'

export type SimulationCaveat =
  | 'state_may_diverge'
  | 'proxy_implementation_unverified'
  | 'compute_budget_estimated'
  | 'account_locking_not_guaranteed'

export type SimulationResult = {
  success: boolean
  chain: ChainId
  simulatedAtBlock: number
  gasEstimate: bigint
  gasBufferApplied: number
  expectedOutput?: TokenAmount
  coverageLevel: SimulationCoverageLevel
  caveats: SimulationCaveat[]
  rawTrace?: unknown
}