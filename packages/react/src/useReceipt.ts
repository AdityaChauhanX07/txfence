import { useState, useEffect } from 'react'
import type { ChainId, SuccessReceipt } from '@txfence/core'

// useReceipt takes a fetcher function rather than calling an adapter directly
// because receipt fetching is chain-specific (EVM uses viem, Solana uses different primitives).
// The builder provides their own fetcher.

export type UseReceiptState = {
  receipt: SuccessReceipt | null
  loading: boolean
  error: string | null
}

export function useReceipt(
  txHash: string | null,
  chain: ChainId | null,
  rpcUrl: string | null,
  fetcher: ((txHash: string, chain: ChainId, rpcUrl: string) => Promise<SuccessReceipt>) | null,
): UseReceiptState {
  const [state, setState] = useState<UseReceiptState>({
    receipt: null,
    loading: false,
    error: null,
  })

  useEffect(() => {
    if (txHash === null || chain === null || rpcUrl === null || fetcher === null) return

    let cancelled = false

    const capturedHash = txHash
    const capturedChain = chain
    const capturedUrl = rpcUrl
    const capturedFetcher = fetcher

    setState({ receipt: null, loading: true, error: null })

    const run = async () => {
      try {
        const receipt = await capturedFetcher(capturedHash, capturedChain, capturedUrl)
        if (!cancelled) setState({ receipt, loading: false, error: null })
      } catch (err) {
        if (!cancelled) {
          setState({
            receipt: null,
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [txHash, chain, rpcUrl, fetcher])

  return state
}
