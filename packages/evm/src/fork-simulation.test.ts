import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { simulateIntentOnFork } from './fork-simulation.js'
import type { Intent, ForkSimulationConfig } from '@txfence/core'

const tenderlyConfig = {
  accessKey: 'test-key',
  accountSlug: 'test-account',
  projectSlug: 'test-project',
}

const forkConfig: ForkSimulationConfig = {
  provider: 'tenderly',
  tenderlyConfig,
  fromAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
}

const forkResponse = {
  simulation_fork: {
    id: 'fork-test-001',
    network_id: '1',
    block_number: 20000000,
    chain_config: { chain_id: 1 },
  },
}

const successSimResponse = {
  simulation: {
    id: 'sim-001', status: true, error_message: null,
    block_number: 20000000, gas_used: 21000,
  },
  contracts: [
    { address: '0xagent', balanceDiff: { before: '1000000', after: '900000' } },
  ],
  call_trace: {}, logs: [],
}

const revertSimResponse = {
  simulation: {
    id: 'sim-002', status: false,
    error_message: 'execution reverted: insufficient funds',
    block_number: 20000000, gas_used: 5000,
  },
  contracts: [], call_trace: {}, logs: [],
}

function makeTransferIntent(steps: Array<{ id: string; amount: bigint; dependsOn?: string[] }>): Intent {
  return {
    id: 'fork-sim-test',
    steps: steps.map(s => ({
      id: s.id,
      action: {
        kind: 'transfer' as const,
        chain: 'ethereum' as const,
        token: { token: 'ETH', amount: s.amount, decimals: 18 },
        to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      },
      ...(s.dependsOn !== undefined ? { dependsOn: s.dependsOn } : {}),
    })),
  }
}

describe('simulateIntentOnFork', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, opts: RequestInit) => {
      if (url.includes('/fork') && opts?.method === 'POST' && !url.includes('/simulate')) {
        return { ok: true, json: async () => forkResponse }
      }
      if (url.includes('/simulate') && opts?.method === 'POST') {
        return { ok: true, json: async () => successSimResponse }
      }
      if (opts?.method === 'DELETE') {
        return { ok: true }
      }
      return { ok: false, status: 404, text: async () => 'not found' }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws when provider is not tenderly', async () => {
    const badConfig: ForkSimulationConfig = {
      provider: 'tenderly',
      fromAddress: '0xagent',
      // no tenderlyConfig
    }
    await expect(
      simulateIntentOnFork(makeTransferIntent([{ id: 'A', amount: 1n }]), badConfig, 'ethereum', 'http://rpc')
    ).rejects.toThrow('tenderlyConfig')
  })

  it('creates and deletes the fork', async () => {
    const intent = makeTransferIntent([{ id: 'A', amount: 1000n }])
    await simulateIntentOnFork(intent, forkConfig, 'ethereum', 'http://rpc')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = (fetch as any).mock.calls as [string, RequestInit][]
    const createCall = calls.find(c =>
      c[0].includes('/fork') && c[1]?.method === 'POST' && !c[0].includes('/simulate')
    )
    const deleteCall = calls.find(c =>
      c[0].includes('/fork') && c[1]?.method === 'DELETE'
    )
    expect(createCall).toBeDefined()
    expect(deleteCall).toBeDefined()
  })

  it('returns correct forkId and forkedAtBlock', async () => {
    const intent = makeTransferIntent([{ id: 'A', amount: 1000n }])
    const result = await simulateIntentOnFork(intent, forkConfig, 'ethereum', 'http://rpc')
    expect(result.forkId).toBe('fork-test-001')
    expect(result.forkedAtBlock).toBe(20000000)
    expect(result.chain).toBe('ethereum')
  })

  it('simulates each step in execution plan order', async () => {
    const intent = makeTransferIntent([
      { id: 'A', amount: 1000n },
      { id: 'B', amount: 2000n, dependsOn: ['A'] },
    ])
    const result = await simulateIntentOnFork(intent, forkConfig, 'ethereum', 'http://rpc')
    expect(result.steps).toHaveLength(2)
    expect(result.steps[0]?.stepId).toBe('A')
    expect(result.steps[1]?.stepId).toBe('B')
  })

  it('returns wouldAllSucceed: true when all steps succeed', async () => {
    const intent = makeTransferIntent([{ id: 'A', amount: 1000n }])
    const result = await simulateIntentOnFork(intent, forkConfig, 'ethereum', 'http://rpc')
    expect(result.wouldAllSucceed).toBe(true)
    expect(result.failingStepId).toBeUndefined()
  })

  it('returns wouldAllSucceed: false when a step reverts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, opts: RequestInit) => {
      if (url.includes('/fork') && opts?.method === 'POST' && !url.includes('/simulate')) {
        return { ok: true, json: async () => forkResponse }
      }
      if (url.includes('/simulate')) {
        return { ok: true, json: async () => revertSimResponse }
      }
      return { ok: true }
    }))
    const intent = makeTransferIntent([
      { id: 'A', amount: 1000n },
      { id: 'B', amount: 2000n },
    ])
    const result = await simulateIntentOnFork(intent, forkConfig, 'ethereum', 'http://rpc')
    expect(result.wouldAllSucceed).toBe(false)
    expect(result.failingStepId).toBe('A')
  })

  it('deletes fork even when simulation throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, opts: RequestInit) => {
      if (url.includes('/fork') && opts?.method === 'POST' && !url.includes('/simulate')) {
        return { ok: true, json: async () => forkResponse }
      }
      if (url.includes('/simulate')) {
        throw new Error('network error')
      }
      return { ok: true }
    }))
    const intent = makeTransferIntent([{ id: 'A', amount: 1000n }])
    const result = await simulateIntentOnFork(intent, forkConfig, 'ethereum', 'http://rpc')
    expect(result.steps[0]?.simulation.success).toBe(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deleteCalled = (fetch as any).mock.calls.some(
      (c: [string, RequestInit]) => c[1]?.method === 'DELETE'
    )
    expect(deleteCalled).toBe(true)
  })

  it('builds cumulative position from state changes', async () => {
    const intent = makeTransferIntent([{ id: 'A', amount: 1000n }])
    const result = await simulateIntentOnFork(intent, forkConfig, 'ethereum', 'http://rpc')
    // successSimResponse has balanceDiff: before 1000000, after 900000 = delta -100000
    expect(result.steps[0]?.stateChanges).toHaveLength(1)
    expect(result.steps[0]?.stateChanges[0]?.delta).toBe(-100000n)
  })
})
