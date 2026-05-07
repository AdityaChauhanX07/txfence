import { describe, it, expect } from 'vitest'
import { createMemoryCapLockProvider } from './memory.js'
import { capLockProviderContract } from '../contracts/index.js'

// ── absolute cap ─────────────────────────────────────────────────────────────

describe('createMemoryCapLockProvider — absolute cap', () => {
  it('grants when spend is within absolute cap', async () => {
    const provider = createMemoryCapLockProvider([
      { capId: 'cap1', absoluteCap: { maxAmount: 1000n, token: 'USDC' } },
    ])
    const result = await provider.acquire('cap1', 100n, 'USDC')
    expect(result.granted).toBe(true)
  })

  it('rejects with absolute_cap_exceeded when spend would exceed absolute cap', async () => {
    const provider = createMemoryCapLockProvider([
      { capId: 'cap1', absoluteCap: { maxAmount: 100n, token: 'USDC' } },
    ])
    const result = await provider.acquire('cap1', 101n, 'USDC')
    expect(result.granted).toBe(false)
    if (result.granted) throw new Error('expected rejection')
    expect(result.reason).toBe('absolute_cap_exceeded')
  })

  it('accounts for pending transactions in the absolute cap check', async () => {
    const provider = createMemoryCapLockProvider([
      { capId: 'cap1', absoluteCap: { maxAmount: 100n, token: 'USDC' } },
    ])
    const r1 = await provider.acquire('cap1', 60n, 'USDC')
    expect(r1.granted).toBe(true)
    // pendingTotal = 60n; 0 + 60 + 50 = 110 > 100
    const r2 = await provider.acquire('cap1', 50n, 'USDC')
    expect(r2.granted).toBe(false)
    if (r2.granted) throw new Error('expected rejection')
    expect(r2.reason).toBe('absolute_cap_exceeded')
  })

  it('releases pending amount correctly on release()', async () => {
    const provider = createMemoryCapLockProvider([
      { capId: 'cap1', absoluteCap: { maxAmount: 100n, token: 'USDC' } },
    ])
    const r1 = await provider.acquire('cap1', 60n, 'USDC')
    expect(r1.granted).toBe(true)
    if (!r1.granted) throw new Error('expected granted')
    await provider.release('cap1', r1.lockId, 60n)
    // pendingTotal = 0n; 0 + 0 + 60 = 60 <= 100
    const r2 = await provider.acquire('cap1', 60n, 'USDC')
    expect(r2.granted).toBe(true)
  })

  it('commits amount to absoluteTotal on commit()', async () => {
    const provider = createMemoryCapLockProvider([
      { capId: 'cap1', absoluteCap: { maxAmount: 200n, token: 'USDC' } },
    ])
    const r1 = await provider.acquire('cap1', 60n, 'USDC')
    expect(r1.granted).toBe(true)
    if (!r1.granted) throw new Error('expected granted')
    await provider.commit('cap1', r1.lockId, 60n)
    // absoluteTotal = 60n, pendingTotal = 0n; can still acquire 100n: 60 + 0 + 100 = 160 <= 200
    const r2 = await provider.acquire('cap1', 100n, 'USDC')
    expect(r2.granted).toBe(true)
  })

  it('rejects after commit pushes total over cap', async () => {
    const provider = createMemoryCapLockProvider([
      { capId: 'cap1', absoluteCap: { maxAmount: 100n, token: 'USDC' } },
    ])
    const r1 = await provider.acquire('cap1', 60n, 'USDC')
    expect(r1.granted).toBe(true)
    if (!r1.granted) throw new Error('expected granted')
    await provider.commit('cap1', r1.lockId, 60n)
    // absoluteTotal = 60n; 60 + 0 + 50 = 110 > 100
    const r2 = await provider.acquire('cap1', 50n, 'USDC')
    expect(r2.granted).toBe(false)
    if (r2.granted) throw new Error('expected rejection')
    expect(r2.reason).toBe('absolute_cap_exceeded')
  })
})

// ── rolling window ───────────────────────────────────────────────────────────

describe('createMemoryCapLockProvider — rolling window', () => {
  it('grants when spend is within rolling window', async () => {
    const provider = createMemoryCapLockProvider([
      { capId: 'cap1', rollingWindow: { windowMs: 60000, maxAmount: 1000n, token: 'USDC' } },
    ])
    const result = await provider.acquire('cap1', 100n, 'USDC')
    expect(result.granted).toBe(true)
  })

  it('rejects with rolling_window_exceeded when spend would exceed window', async () => {
    const provider = createMemoryCapLockProvider([
      { capId: 'cap1', rollingWindow: { windowMs: 60000, maxAmount: 100n, token: 'USDC' } },
    ])
    const result = await provider.acquire('cap1', 101n, 'USDC')
    expect(result.granted).toBe(false)
    if (result.granted) throw new Error('expected rejection')
    expect(result.reason).toBe('rolling_window_exceeded')
  })

  it('prunes expired buckets from the window', async () => {
    const provider = createMemoryCapLockProvider([
      { capId: 'cap1', rollingWindow: { windowMs: 50, maxAmount: 100n, token: 'USDC' } },
    ])
    const r1 = await provider.acquire('cap1', 80n, 'USDC')
    expect(r1.granted).toBe(true)
    if (!r1.granted) throw new Error('expected granted')
    await provider.commit('cap1', r1.lockId, 80n)
    // wait for the 50ms window to expire
    await new Promise(resolve => setTimeout(resolve, 60))
    // expired bucket is pruned; 0 + 0 + 80 = 80 <= 100
    const r2 = await provider.acquire('cap1', 80n, 'USDC')
    expect(r2.granted).toBe(true)
  })

  it('accounts for pending transactions in the rolling window check', async () => {
    const provider = createMemoryCapLockProvider([
      { capId: 'cap1', rollingWindow: { windowMs: 60000, maxAmount: 100n, token: 'USDC' } },
    ])
    const r1 = await provider.acquire('cap1', 60n, 'USDC')
    expect(r1.granted).toBe(true)
    // pendingTotal = 60n; windowTotal + 60 + 50 = 110 > 100
    const r2 = await provider.acquire('cap1', 50n, 'USDC')
    expect(r2.granted).toBe(false)
    if (r2.granted) throw new Error('expected rejection')
    expect(r2.reason).toBe('rolling_window_exceeded')
  })
})

// ── both caps ────────────────────────────────────────────────────────────────

describe('createMemoryCapLockProvider — both caps', () => {
  it('rejects on absolute cap even when rolling window would pass', async () => {
    const provider = createMemoryCapLockProvider([
      {
        capId: 'cap1',
        absoluteCap: { maxAmount: 50n, token: 'USDC' },
        rollingWindow: { windowMs: 60000, maxAmount: 200n, token: 'USDC' },
      },
    ])
    const result = await provider.acquire('cap1', 60n, 'USDC')
    expect(result.granted).toBe(false)
    if (result.granted) throw new Error('expected rejection')
    expect(result.reason).toBe('absolute_cap_exceeded')
  })

  it('rejects on rolling window even when absolute cap would pass', async () => {
    const provider = createMemoryCapLockProvider([
      {
        capId: 'cap1',
        absoluteCap: { maxAmount: 200n, token: 'USDC' },
        rollingWindow: { windowMs: 60000, maxAmount: 50n, token: 'USDC' },
      },
    ])
    const result = await provider.acquire('cap1', 60n, 'USDC')
    expect(result.granted).toBe(false)
    if (result.granted) throw new Error('expected rejection')
    expect(result.reason).toBe('rolling_window_exceeded')
  })

  it('grants when both caps pass', async () => {
    const provider = createMemoryCapLockProvider([
      {
        capId: 'cap1',
        absoluteCap: { maxAmount: 200n, token: 'USDC' },
        rollingWindow: { windowMs: 60000, maxAmount: 200n, token: 'USDC' },
      },
    ])
    const result = await provider.acquire('cap1', 100n, 'USDC')
    expect(result.granted).toBe(true)
  })
})

capLockProviderContract('createMemoryCapLockProvider — contract', (configs) => createMemoryCapLockProvider(configs))
