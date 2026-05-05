import { describe, it, expect, vi, afterEach } from 'vitest'
import { simulateWithTenderly } from './tenderly.js'
import type { TenderlyConfig } from './simulate.js'
import type { Action } from '@txfence/core'

const config: TenderlyConfig = {
  accountSlug: 'test-account',
  projectSlug: 'test-project',
  accessKey: 'test-key',
}

const transferAction: Action = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'ETH', amount: 1000000000000000000n, decimals: 18 },
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(ok: boolean, data?: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data ?? {}),
  }))
}

const successData = {
  simulation: { status: true, gas_used: 21000, block_number: 12345 },
  transaction: { call_trace: { type: 'CALL' }, state_diff: {}, logs: [] },
}

describe('simulateWithTenderly', () => {
  it('returns a deep successful simulation result', async () => {
    mockFetch(true, successData)
    const result = await simulateWithTenderly(transferAction, 'ethereum', config)
    expect(result.success).toBe(true)
    expect(result.wouldRevert).toBe(false)
    expect(result.coverageLevel).toBe('deep')
    expect(result.provider).toBe('tenderly')
    expect(result.gasEstimate).toBeGreaterThan(0n)
    expect(result.caveats).toHaveLength(0)
    expect(result.trace).toBeDefined()
  })

  it('returns wouldRevert true and sets revertReason when status is false', async () => {
    mockFetch(true, {
      simulation: {
        status: false,
        gas_used: 0,
        block_number: 12345,
        error_message: 'execution reverted',
      },
    })
    const result = await simulateWithTenderly(transferAction, 'ethereum', config)
    expect(result.success).toBe(false)
    expect(result.wouldRevert).toBe(true)
    expect(result.revertReason).toBe('execution reverted')
    expect(result.coverageLevel).toBe('deep')
    expect(result.provider).toBe('tenderly')
  })

  it('returns coverage none when the API returns a non-ok response', async () => {
    mockFetch(false)
    const result = await simulateWithTenderly(transferAction, 'ethereum', config)
    expect(result.success).toBe(false)
    expect(result.coverageLevel).toBe('none')
    expect(result.provider).toBe('tenderly')
  })

  it('returns coverage none when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const result = await simulateWithTenderly(transferAction, 'ethereum', config)
    expect(result.success).toBe(false)
    expect(result.coverageLevel).toBe('none')
  })

  it('throws for chains not supported by Tenderly', async () => {
    const solanaAction: Action = {
      kind: 'transfer',
      chain: 'solana',
      token: { token: 'SOL', amount: 1000000000n, decimals: 9 },
      to: 'DummyAddress',
    }
    await expect(simulateWithTenderly(solanaAction, 'solana', config)).rejects.toThrow('solana')
  })

  it('includes state_objects in the request body when stateOverrides are provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(successData) })
    vi.stubGlobal('fetch', fetchMock)

    await simulateWithTenderly(transferAction, 'ethereum', config, {
      stateOverrides: { '0xabc': { balance: 1000000000000000000n, nonce: 5 } },
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { state_objects?: unknown }
    expect(body.state_objects).toBeDefined()
  })

  it('sends the correct X-Access-Key header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(successData) })
    vi.stubGlobal('fetch', fetchMock)

    await simulateWithTenderly(transferAction, 'ethereum', config)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['X-Access-Key']).toBe('test-key')
  })
})
