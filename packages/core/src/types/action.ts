import type { ChainId, TokenAmount, Policy } from './policy.js'

export type SwapAction = {
  kind: 'swap'
  chain: ChainId
  from: TokenAmount
  to: string
  via: string
  maxSlippage: number
}

export type TransferAction = {
  kind: 'transfer'
  chain: ChainId
  token: TokenAmount
  to: string
}

export type ContractCallAction = {
  kind: 'contract_call'
  chain: ChainId
  contract: string
  method: string
  args: unknown[]
  value?: TokenAmount
}

export type Action =
  | SwapAction
  | TransferAction
  | ContractCallAction

export type BoundAction = {
  action: Action
  policy: Policy
}