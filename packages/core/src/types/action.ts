import type { ChainId, TokenAmount, Policy } from './policy.js'

export type SwapAction = {
  kind: 'swap'
  chain: ChainId
  from: TokenAmount
  to: string
  via: string
  maxSlippage: number
  calldata?: `0x${string}`
}

export type TransferAction = {
  kind: 'transfer'
  chain: ChainId
  token: TokenAmount
  to: string
  calldata?: `0x${string}`
}

export type ContractCallAction = {
  kind: 'contract_call'
  chain: ChainId
  contract: string
  method: string
  args: unknown[]
  value?: TokenAmount
  calldata?: `0x${string}`
}

export type Action =
  | SwapAction
  | TransferAction
  | ContractCallAction

export type BoundAction = {
  action: Action
  policy: Policy
}