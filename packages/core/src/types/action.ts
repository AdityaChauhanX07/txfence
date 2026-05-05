import type { ChainId, TokenAmount, Policy } from './policy.js'

export type SolanaAccountMeta = {
  address: string
  role: 'writable_signer' | 'readonly_signer' | 'writable' | 'readonly'
}

export type SwapAction = {
  kind: 'swap'
  chain: ChainId
  from: TokenAmount
  to: string
  via: string
  maxSlippage: number
  calldata?: `0x${string}`           // EVM: pre-encoded calldata
  solanaTransaction?: Uint8Array     // Solana: pre-built serialized transaction bytes
  cosmosTransaction?: Uint8Array     // Cosmos: pre-built serialized transaction bytes
}

export type TransferAction = {
  kind: 'transfer'
  chain: ChainId
  token: TokenAmount
  to: string
  calldata?: `0x${string}`
  solanaTransaction?: Uint8Array
  cosmosTransaction?: Uint8Array   // pre-built for non-MsgSend Cosmos transfers
}

export type ContractCallAction = {
  kind: 'contract_call'
  chain: ChainId
  contract: string
  method: string
  args: unknown[]
  value?: TokenAmount
  calldata?: `0x${string}`                  // EVM: pre-encoded calldata
  solanaAccounts?: SolanaAccountMeta[]      // Solana: account metas for the instruction
  solanaData?: Uint8Array                   // Solana: pre-encoded instruction data
  solanaTransaction?: Uint8Array            // Solana: pre-built full serialized transaction (overrides accounts+data)
  cosmosTransaction?: Uint8Array            // Cosmos: pre-built serialized transaction bytes
}

export type Action =
  | SwapAction
  | TransferAction
  | ContractCallAction

export type BoundAction = {
  action: Action
  policy: Policy
}
