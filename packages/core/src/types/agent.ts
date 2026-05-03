import type { Policy } from './policy.js'
import type { Action, BoundAction } from './action.js'
import type { ExecutionResult } from './receipt.js'

export type AgentConfig = {
  chains: Policy['chains']
  policies: Policy
  signer: Signer
}

export type Signer = {
  sign: (tx: SerializedTransaction) => Promise<string>
  address: string
}

export type SerializedTransaction = {
  chain: string
  data: string
}

export type Agent = {
  submit: (action: BoundAction) => Promise<ExecutionResult>
  config: AgentConfig
}