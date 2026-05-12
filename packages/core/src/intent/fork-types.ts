// Fork simulation types for "what-if" multi-step analysis.
// Fork simulation runs a sequence of transactions against a forked chain state,
// building up position deltas as each step applies its state changes.
// This gives an accurate picture of the final portfolio position before committing.
//
// EVM: implemented via Tenderly Fork API in @txfence/evm
// Solana: planned for v2 using simulateTransaction with account overrides
//
// Known limitation: StateChange tracking depends on what the simulation provider
// returns. Tenderly returns full state diffs. eth_call does not — fork simulation
// requires Tenderly for EVM.

import type { ChainId } from '../types/policy.js'
import type { SimulationResult } from '../types/simulation.js'
import type { PositionChange } from './types.js'

export type ForkSimulationProvider = 'tenderly'
// 'solana_override' planned for v2

export type TenderlyForkConfig = {
  accessKey: string
  accountSlug: string
  projectSlug: string
}

export type ForkSimulationConfig = {
  provider: ForkSimulationProvider
  tenderlyConfig?: TenderlyForkConfig   // required when provider === 'tenderly'
  blockNumber?: number                  // fork at specific block (default: latest)
  fromAddress: string                   // agent address for all simulated transactions
}

export type StateChange = {
  address: string                       // contract or EOA whose state changed
  token?: string                        // token symbol if known
  balanceBefore: bigint
  balanceAfter: bigint
  delta: bigint                         // balanceAfter - balanceBefore
}

export type StepForkSimulationResult = {
  stepId: string
  simulation: SimulationResult          // existing per-tx simulation result
  stateChanges: StateChange[]           // what changed in the fork after this step
  cumulativePosition: PositionChange[]  // running position after this step
  wouldRevert: boolean
  revertReason?: string
}

export type ForkSimulationResult = {
  forkId: string                        // Tenderly fork ID (for debugging)
  chain: ChainId
  forkedAtBlock: number
  steps: StepForkSimulationResult[]
  finalPosition: PositionChange[]       // net position change after all steps
  wouldAllSucceed: boolean              // true if no step would revert
  failingStepId?: string               // first step that would revert
  simulatedAt: number                  // Date.now() when simulation ran
}
