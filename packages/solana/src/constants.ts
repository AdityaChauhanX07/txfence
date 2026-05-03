export const SOLANA_CHAIN_IDS = ['solana'] as const

export type SolanaChainId = typeof SOLANA_CHAIN_IDS[number]

export function isSolanaChain(chainId: string): chainId is SolanaChainId {
  return (SOLANA_CHAIN_IDS as readonly string[]).includes(chainId)
}
