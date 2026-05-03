export type ChainId =
  | 'ethereum'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'solana'

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
}