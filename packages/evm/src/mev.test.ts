import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getMevProtectedRpcUrl, broadcastWithMevProtection } from './mev.js'
import type { MevProtectionConfig } from '@txfence/core'

describe('getMevProtectedRpcUrl', () => {
  it('returns flashbots URL for mode flashbots', () => {
    const url = getMevProtectedRpcUrl('flashbots')
    expect(url).toBe('https://rpc.flashbots.net')
  })

  it('returns custom flashbots URL when configured', () => {
    const config: MevProtectionConfig = {
      flashbots: { rpcUrl: 'https://my-flashbots.example.com' },
    }
    expect(getMevProtectedRpcUrl('flashbots', config)).toBe('https://my-flashbots.example.com')
  })

  it('returns mev-blocker URL for mode mev-blocker', () => {
    expect(getMevProtectedRpcUrl('mev-blocker')).toBe('https://rpc.mevblocker.io')
  })

  it('returns custom mev-blocker URL when configured', () => {
    const config: MevProtectionConfig = {
      mevBlocker: { rpcUrl: 'https://my-mevblocker.example.com' },
    }
    expect(getMevProtectedRpcUrl('mev-blocker', config)).toBe('https://my-mevblocker.example.com')
  })

  it('returns fallback URL for mode none', () => {
    expect(getMevProtectedRpcUrl('none', undefined, 'https://my-rpc.com')).toBe('https://my-rpc.com')
  })

  it('returns fallback URL for undefined mode', () => {
    expect(getMevProtectedRpcUrl(undefined, undefined, 'https://my-rpc.com')).toBe('https://my-rpc.com')
  })
})

describe('broadcastWithMevProtection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', result: '0xTXHASH', id: 1 }),
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('broadcasts to flashbots URL', async () => {
    const txHash = await broadcastWithMevProtection(
      '0xSIGNED_TX' as `0x${string}`,
      'flashbots',
    )
    expect(txHash).toBe('0xTXHASH')
    expect(fetch).toHaveBeenCalledWith(
      'https://rpc.flashbots.net',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('broadcasts to mev-blocker URL', async () => {
    await broadcastWithMevProtection('0xSIGNED_TX' as `0x${string}`, 'mev-blocker')
    expect(fetch).toHaveBeenCalledWith(
      'https://rpc.mevblocker.io',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('sends eth_sendRawTransaction in body', async () => {
    await broadcastWithMevProtection('0xSIGNED_TX' as `0x${string}`, 'flashbots')
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body)
    expect(body.method).toBe('eth_sendRawTransaction')
    expect(body.params[0]).toBe('0xSIGNED_TX')
  })

  it('throws when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    }))
    await expect(
      broadcastWithMevProtection('0xTX' as `0x${string}`, 'flashbots'),
    ).rejects.toThrow('429')
  })

  it('throws when response contains error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', error: { message: 'nonce too low' }, id: 1 }),
    }))
    await expect(
      broadcastWithMevProtection('0xTX' as `0x${string}`, 'flashbots'),
    ).rejects.toThrow('nonce too low')
  })

  it('uses fallback RPC for mode none', async () => {
    await broadcastWithMevProtection(
      '0xTX' as `0x${string}`,
      'none',
      undefined,
      'https://my-rpc.com',
    )
    expect(fetch).toHaveBeenCalledWith(
      'https://my-rpc.com',
      expect.any(Object),
    )
  })
})
