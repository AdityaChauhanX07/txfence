import type { CapConfig } from '../caps/provider.js'
import type { MevProtectionMode } from './mev.js'
import type { TemporalRule } from '../temporal/types.js'

export type ChainId =
  | 'ethereum'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'solana'
  | 'cosmoshub'
  | 'osmosis'

export type TokenAmount = {
  token: string
  amount: bigint
  decimals: number
}

export type ContractEntry = {
  address: string
  chain: ChainId
  bytecodeHash?: string
  ownerAddress?: string
  expiresAt?: number
}

export type CapLockMode = 'per-agent' | 'shared'

export type Policy = {
  chains: ChainId[]
  maxSpendPerTx: TokenAmount
  allowedContracts: ContractEntry[]
  requireSimulation: boolean
  gasBufferMultiplier: number
  humanApprovalThreshold: TokenAmount
  humanApprovalTimeoutMs: number
  capLockMode: CapLockMode
  capLocks?: CapConfig[]
  simulationStalenessMs?: number
  mevProtection?: MevProtectionMode
  // Per-transaction MEV protection. Default 'none'.
  // 'flashbots' routes through Flashbots Protect RPC.
  // 'mev-blocker' routes through MEV Blocker (CoW Protocol).
  // Only applies to EVM chains — ignored by Solana and Cosmos adapters.
  temporalRules?: TemporalRule[]
  // Stateful rules evaluated against the sliding window of pipeline events.
  // Evaluated after static policy checks, before simulation.
  // Requires an EventStore to be passed to runPipeline or createAgent.
}