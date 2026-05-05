import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSimulate, useSubmit } from './index.js'
import type { SimulationResult, Policy, TransferAction } from '@txfence/core'

const passingSim: SimulationResult = {
  success: true,
  wouldRevert: false,
  chain: 'ethereum',
  simulatedAtBlock: 1000,
  gasEstimate: 21000n,
  gasBufferApplied: 1.2,
  coverageLevel: 'partial',
  caveats: ['state_may_diverge'],
  provider: 'eth_call',
}

const basePolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 6 },
  allowedContracts: [],
  requireSimulation: false,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent',
}

const transferAction: TransferAction = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}

const mockAdapter = {
  simulate: vi.fn().mockResolvedValue(passingSim),
}

const mockAgent = {
  config: {
    chains: ['ethereum'] as const,
    policies: basePolicy,
    signer: {
      address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      sign: async () => '0x' as `0x${string}`,
    },
  },
  submit: vi.fn().mockResolvedValue({
    status: 'execution_failed',
    action: transferAction,
    txHash: '',
    reason: 'signing and broadcasting not yet implemented',
  }),
}

describe('useSimulate', () => {
  it('starts with null result and not loading', () => {
    const { result } = renderHook(() =>
      useSimulate({ ethereum: mockAdapter }, { ethereum: 'http://localhost:8545' }),
    )
    expect(result.current.result).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets loading while simulating then sets result', async () => {
    const { result } = renderHook(() =>
      useSimulate({ ethereum: mockAdapter }, { ethereum: 'http://localhost:8545' }),
    )
    await act(async () => {
      await result.current.simulate(transferAction)
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.result).not.toBeNull()
    expect(result.current.result?.success).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('sets error when no adapter is configured for the chain', async () => {
    const { result } = renderHook(() =>
      useSimulate({}, { ethereum: 'http://localhost:8545' }),
    )
    await act(async () => {
      await result.current.simulate(transferAction)
    })
    expect(result.current.error).toContain('ethereum')
    expect(result.current.result).toBeNull()
  })

  it('resets state correctly', async () => {
    const { result } = renderHook(() =>
      useSimulate({ ethereum: mockAdapter }, { ethereum: 'http://localhost:8545' }),
    )
    await act(async () => {
      await result.current.simulate(transferAction)
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
  })
})

describe('useSubmit', () => {
  it('starts with null result and not loading', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { result } = renderHook(() => useSubmit(mockAgent as any))
    expect(result.current.result).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('sets result after submit', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { result } = renderHook(() => useSubmit(mockAgent as any))
    await act(async () => {
      await result.current.submit(transferAction, basePolicy)
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.result).not.toBeNull()
    expect(result.current.result?.status).toBe('execution_failed')
  })

  it('resets state correctly', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { result } = renderHook(() => useSubmit(mockAgent as any))
    await act(async () => {
      await result.current.submit(transferAction, basePolicy)
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.result).toBeNull()
  })
})
