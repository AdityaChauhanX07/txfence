import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFork, simulateOnFork, deleteFork, buildForkTransactionParams } from './fork-client.js'
import type { TenderlyForkConfig } from '@txfence/core'

const config: TenderlyForkConfig = {
  accessKey: 'test-key',
  accountSlug: 'test-account',
  projectSlug: 'test-project',
}

const forkResponse = {
  simulation_fork: {
    id: 'fork-abc123',
    network_id: '1',
    block_number: 20000000,
    chain_config: { chain_id: 1 },
  },
}

const simulationResponse = {
  simulation: {
    id: 'sim-001',
    status: true,
    error_message: null,
    block_number: 20000000,
    gas_used: 21000,
  },
  contracts: [
    {
      address: '0xagent',
      balanceDiff: { before: '1000', after: '500' },
    },
  ],
  call_trace: {},
  logs: [],
}

const revertResponse = {
  simulation: {
    id: 'sim-002',
    status: false,
    error_message: 'execution reverted: insufficient balance',
    block_number: 20000000,
    gas_used: 5000,
  },
  contracts: [],
  call_trace: {},
  logs: [],
}

describe('createFork', () => {
  it('POSTs to the correct Tenderly endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => forkResponse,
    }))
    const result = await createFork(config, 'ethereum')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('test-account/project/test-project/fork'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(result.forkId).toBe('fork-abc123')
    expect(result.forkedAtBlock).toBe(20000000)
    vi.unstubAllGlobals()
  })

  it('includes blockNumber in body when provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => forkResponse,
    }))
    await createFork(config, 'ethereum', 19000000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = JSON.parse((fetch as any).mock.calls[0][1].body)
    expect(body.block_number).toBe(19000000)
    vi.unstubAllGlobals()
  })

  it('throws when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401, text: async () => 'Unauthorized',
    }))
    await expect(createFork(config, 'ethereum')).rejects.toThrow('401')
    vi.unstubAllGlobals()
  })
})

describe('simulateOnFork', () => {
  it('POSTs to the fork simulate endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => simulationResponse,
    }))
    const result = await simulateOnFork(
      config, 'fork-abc123',
      { from: '0xagent', to: '0xcontract', input: '0x', value: '0x0', gas: 21000 },
      'ethereum', 20000000
    )
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('fork/fork-abc123/simulate'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(result.success).toBe(true)
    expect(result.wouldRevert).toBe(false)
    expect(result.gasUsed).toBe(21000)
    vi.unstubAllGlobals()
  })

  it('extracts state changes from contracts diff', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => simulationResponse,
    }))
    const result = await simulateOnFork(
      config, 'fork-abc123',
      { from: '0xagent', to: '0xcontract', input: '0x', value: '0x0', gas: 21000 },
      'ethereum', 20000000
    )
    expect(result.stateChanges).toHaveLength(1)
    expect(result.stateChanges[0]?.delta).toBe(-500n)
    expect(result.stateChanges[0]?.balanceBefore).toBe(1000n)
    expect(result.stateChanges[0]?.balanceAfter).toBe(500n)
    vi.unstubAllGlobals()
  })

  it('correctly identifies a reverting simulation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => revertResponse,
    }))
    const result = await simulateOnFork(
      config, 'fork-abc123',
      { from: '0xagent', to: '0xcontract', input: '0x', value: '0x0', gas: 21000 },
      'ethereum', 20000000
    )
    expect(result.wouldRevert).toBe(true)
    expect(result.revertReason).toContain('insufficient balance')
    vi.unstubAllGlobals()
  })
})

describe('deleteFork', () => {
  it('DELETEs the fork endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    await deleteFork(config, 'fork-abc123')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('fork/fork-abc123'),
      expect.objectContaining({ method: 'DELETE' })
    )
    vi.unstubAllGlobals()
  })

  it('does not throw when fork is already deleted (404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(deleteFork(config, 'fork-abc123')).resolves.not.toThrow()
    vi.unstubAllGlobals()
  })
})

describe('buildForkTransactionParams', () => {
  it('builds transfer params correctly', () => {
    const action = {
      kind: 'transfer' as const, chain: 'ethereum' as const,
      token: { token: 'ETH', amount: 1000000000000000000n, decimals: 18 },
      to: '0xrecipient',
    }
    const params = buildForkTransactionParams(action, '0xagent')
    expect(params.from).toBe('0xagent')
    expect(params.to).toBe('0xrecipient')
    expect(params.input).toBe('0x')
    expect(params.value).toBe('0xde0b6b3a7640000')  // 1 ETH in hex
  })

  it('builds swap params with calldata', () => {
    const action = {
      kind: 'swap' as const, chain: 'ethereum' as const,
      from: { token: 'USDC', amount: 1000000n, decimals: 6 },
      to: 'ETH', via: '0xrouter', maxSlippage: 50,
      calldata: '0xabc123' as `0x${string}`,
    }
    const params = buildForkTransactionParams(action, '0xagent')
    expect(params.to).toBe('0xrouter')
    expect(params.input).toBe('0xabc123')
  })

  it('builds contract_call params with value', () => {
    const action = {
      kind: 'contract_call' as const, chain: 'ethereum' as const,
      contract: '0xcontract', method: 'deposit', args: [],
      value: { token: 'ETH', amount: 500n, decimals: 18 },
    }
    const params = buildForkTransactionParams(action, '0xagent')
    expect(params.to).toBe('0xcontract')
    expect(params.value).toBe('0x1f4')  // 500 in hex
  })
})
