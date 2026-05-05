import type { Policy, ChainId } from './policy.js'
import type { Action, BoundAction } from './action.js'
import type { ExecutionResult } from './receipt.js'

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

export type Agent = {
  submit: (action: BoundAction) => Promise<ExecutionResult>
  config: AgentConfig
}