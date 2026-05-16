import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useSimulate,
  useSubmit,
  useDryRun,
  useIntentSubmit,
  useAgentHealth,
} from './index.js'
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
  dryRun: vi.fn().mockResolvedValue({
    action: transferAction,
    evaluation: { passed: true, checksRun: [] },
    approvalRequired: false,
    capLockAvailable: true,
    wouldProceed: true,
    blockers: [],
    dryRunAt: 0,
  }),
  executeIntent: vi.fn().mockResolvedValue({
    intentId: 'intent-1',
    status: 'completed',
    stepResults: [],
    completedStepIds: [],
    failedStepIds: [],
    skippedStepIds: [],
    receipts: {},
    positionAnalysis: {
      steps: [],
      totalGrossOutflow: 0n,
      netChange: [],
      maxIntermediateExposure: 0n,
      isSingleToken: true,
    },
    intentEvaluation: {
      passed: true,
      intentId: 'intent-1',
      stepEvaluations: [],
      executionPlan: [],
    },
    startedAt: 0,
    completedAt: 0,
    durationMs: 0,
  }),
  health: vi.fn().mockReturnValue({
    status: 'healthy',
    inFlight: 0,
    uptime: 1000,
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

describe('useDryRun', () => {
  it('starts with null result and not loading', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { result } = renderHook(() => useDryRun(mockAgent as any))
    expect(result.current.result).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('sets result after dryRun', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { result } = renderHook(() => useDryRun(mockAgent as any))
    await act(async () => {
      await result.current.dryRun(transferAction, basePolicy)
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.result).not.toBeNull()
    expect(result.current.result?.wouldProceed).toBe(true)
  })

  it('resets state correctly', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { result } = renderHook(() => useDryRun(mockAgent as any))
    await act(async () => {
      await result.current.dryRun(transferAction, basePolicy)
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.result).toBeNull()
  })
})

describe('useIntentSubmit', () => {
  const intent = {
    id: 'intent-1',
    steps: [{ id: 'step-1', action: transferAction }],
  }

  it('starts with null result and not loading', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { result } = renderHook(() => useIntentSubmit(mockAgent as any))
    expect(result.current.result).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('sets result after executeIntent', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { result } = renderHook(() => useIntentSubmit(mockAgent as any))
    await act(async () => {
      await result.current.executeIntent(intent)
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.result?.status).toBe('completed')
  })
})

describe('useAgentHealth', () => {
  it('returns initial health snapshot synchronously', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { result } = renderHook(() => useAgentHealth(mockAgent as any))
    expect(result.current.status).toBe('healthy')
    expect(result.current.inFlight).toBe(0)
  })

  it('polls at configured interval', async () => {
    vi.useFakeTimers()
    mockAgent.health.mockClear()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderHook(() => useAgentHealth(mockAgent as any, { pollIntervalMs: 100 }))
    expect(mockAgent.health).toHaveBeenCalled()
    const before = mockAgent.health.mock.calls.length
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    expect(mockAgent.health.mock.calls.length).toBeGreaterThan(before)
    vi.useRealTimers()
  })
})
