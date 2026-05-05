import { describe, it, expect, vi } from 'vitest'
import type { SimulationResult } from '../types/simulation.js'
import type { Action } from '../types/action.js'
import type { ChainAdapter } from '../agent/adapter.js'
import { createMultiChainAdapter } from './multi.js'

// ── fixtures ─────────────────────────────────────────────────────────────────

const passingSimResult: SimulationResult = {
  success: true,
  wouldRevert: false,
  chain: 'ethereum',
  simulatedAtBlock: 1000,
  gasEstimate: 100000n,
  gasBufferApplied: 1.3,
  coverageLevel: 'basic',
  caveats: ['state_may_diverge'],
  provider: 'eth_call',
}

const baseAction: Action = {
  kind: 'swap',
  chain: 'ethereum',
  from: { token: 'USDC', amount: 100n, decimals: 6 },
  to: 'ETH',
  via: '0xUNISWAP',
  maxSlippage: 50,
}

// ── createMultiChainAdapter ───────────────────────────────────────────────────

describe('createMultiChainAdapter', () => {
  it('routes to the correct adapter based on action chain', async () => {
    const ethereumSim = vi.fn().mockResolvedValue({ ...passingSimResult, chain: 'ethereum' })
    const solanaSim = vi.fn().mockResolvedValue({ ...passingSimResult, chain: 'solana' })
    const ethereumAdapter: ChainAdapter = { simulate: ethereumSim }
    const solanaAdapter: ChainAdapter = { simulate: solanaSim }

    const multi = createMultiChainAdapter({ ethereum: ethereumAdapter, solana: solanaAdapter })

    const ethAction: Action = { ...baseAction, chain: 'ethereum' }
    await multi.simulate(ethAction, 'ethereum', 'https://rpc.ethereum.com')
    expect(ethereumSim).toHaveBeenCalledOnce()
    expect(solanaSim).not.toHaveBeenCalled()

    const solanaAction: Action = { ...baseAction, chain: 'solana' }
    await multi.simulate(solanaAction, 'solana', 'https://rpc.solana.com')
    expect(solanaSim).toHaveBeenCalledOnce()
  })

  it('throws a descriptive error when no adapter is registered for the chain', async () => {
    const multi = createMultiChainAdapter({ ethereum: { simulate: vi.fn() } })

    const action: Action = { ...baseAction, chain: 'solana' }
    await expect(multi.simulate(action, 'solana', 'https://rpc.solana.com')).rejects.toThrow('solana')
    await expect(multi.simulate(action, 'solana', 'https://rpc.solana.com')).rejects.toThrow('ethereum')
  })

  it('returns the simulation result from the adapter', async () => {
    const mockResult: SimulationResult = { ...passingSimResult, gasEstimate: 999n }
    const adapter: ChainAdapter = { simulate: vi.fn().mockResolvedValue(mockResult) }

    const multi = createMultiChainAdapter({ ethereum: adapter })
    const result = await multi.simulate(baseAction, 'ethereum', 'https://rpc.ethereum.com')
    expect(result).toEqual(mockResult)
  })
})
