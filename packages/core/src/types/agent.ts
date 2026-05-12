import type { Policy, ChainId } from './policy.js'
import type { Action } from './action.js'
import type { ExecutionResult } from './receipt.js'
import type { DryRunResult } from '../agent/dry-run.js'
import type { Intent, IntentExecutionResult } from '../intent/types.js'
import type { IntentExecutionOptions } from '../intent/execute.js'

export type AgentConfig = {
  chains: Policy['chains']
  policies: Policy
  signer: Signer
}

export type Signer = {
  address: `0x${string}`
  sign: (tx: SerializedTransaction) => Promise<`0x${string}`>
}

export type SerializedTransaction = {
  chain: ChainId
  to: string
  value: bigint
  data: `0x${string}`
  gas: bigint
  chainId: number
  rpcUrl: string
}

export type AgentShutdownResult = {
  completed: number
  abandoned: number
  capLocksReleased: number
}

export type AgentHealth = {
  status: 'healthy' | 'shutting_down'
  inFlight: number
  uptime: number
}

export type Agent = {
  submit: (input: { action: Action; policy: Policy }) => Promise<ExecutionResult>
  dryRun: (input: { action: Action; policy: Policy }) => Promise<DryRunResult>
  executeIntent: (
    intent: Intent,
    options?: Partial<IntentExecutionOptions>,
  ) => Promise<IntentExecutionResult>
  shutdown: (timeoutMs?: number) => Promise<AgentShutdownResult>
  isShuttingDown: () => boolean
  health: () => AgentHealth
  config: AgentConfig
}
