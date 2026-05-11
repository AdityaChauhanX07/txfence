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

// ── inspect() ────────────────────────────────────────────────────────────────

describe('createMemoryCapLockProvider — inspect()', () => {
  it('returns full remaining when nothing spent', async () => {
    const provider = createMemoryCapLockProvider([{
      capId: 'inspect-1',
      absoluteCap: { maxAmount: 1000n, token: 'USDC' },
    }])
    const inspection = await provider.inspect('inspect-1')
    expect(inspection.capId).toBe('inspect-1')
    expect(inspection.absoluteCap?.maxAmount).toBe(1000n)
    expect(inspection.absoluteCap?.totalCommitted).toBe(0n)
    expect(inspection.absoluteCap?.totalPending).toBe(0n)
    expect(inspection.absoluteCap?.remaining).toBe(1000n)
    expect(inspection.absoluteCap?.pctUsed).toBe(0)
    expect(inspection.activeLocks).toBe(0)
  })

  it('reflects pending after acquire', async () => {
    const provider = createMemoryCapLockProvider([{
      capId: 'inspect-2',
      absoluteCap: { maxAmount: 1000n, token: 'USDC' },
    }])
    const result = await provider.acquire('inspect-2', 300n, 'USDC')
    expect(result.granted).toBe(true)
    const inspection = await provider.inspect('inspect-2')
    expect(inspection.absoluteCap?.totalPending).toBe(300n)
    expect(inspection.absoluteCap?.remaining).toBe(700n)
    expect(inspection.activeLocks).toBe(1)
  })

  it('reflects committed after commit', async () => {
    const provider = createMemoryCapLockProvider([{
      capId: 'inspect-3',
      absoluteCap: { maxAmount: 1000n, token: 'USDC' },
    }])
    const result = await provider.acquire('inspect-3', 300n, 'USDC')
    if (!result.granted) throw new Error('expected granted')
    await provider.commit('inspect-3', result.lockId, 300n)
    const inspection = await provider.inspect('inspect-3')
    expect(inspection.absoluteCap?.totalCommitted).toBe(300n)
    expect(inspection.absoluteCap?.totalPending).toBe(0n)
    expect(inspection.absoluteCap?.remaining).toBe(700n)
    expect(inspection.activeLocks).toBe(0)
  })

  it('reflects restored remaining after release', async () => {
    const provider = createMemoryCapLockProvider([{
      capId: 'inspect-4',
      absoluteCap: { maxAmount: 1000n, token: 'USDC' },
    }])
    const result = await provider.acquire('inspect-4', 300n, 'USDC')
    if (!result.granted) throw new Error('expected granted')
    await provider.release('inspect-4', result.lockId, 300n)
    const inspection = await provider.inspect('inspect-4')
    expect(inspection.absoluteCap?.remaining).toBe(1000n)
    expect(inspection.activeLocks).toBe(0)
  })

  it('returns rolling window inspection with resetsAt', async () => {
    const provider = createMemoryCapLockProvider([{
      capId: 'inspect-5',
      rollingWindow: { windowMs: 3_600_000, maxAmount: 1000n, token: 'USDC' },
    }])
    const result = await provider.acquire('inspect-5', 400n, 'USDC')
    if (!result.granted) throw new Error('expected granted')
    await provider.commit('inspect-5', result.lockId, 400n)
    const inspection = await provider.inspect('inspect-5')
    expect(inspection.rollingWindow?.totalInWindow).toBe(400n)
    expect(inspection.rollingWindow?.remaining).toBe(600n)
    expect(inspection.rollingWindow?.resetsAt).toBeGreaterThan(Date.now())
    expect(inspection.rollingWindow?.resetsAt).toBeLessThanOrEqual(Date.now() + 3_600_000 + 100)
  })

  it('throws for unknown capId', async () => {
    const provider = createMemoryCapLockProvider([])
    await expect(provider.inspect('nonexistent')).rejects.toThrow('nonexistent')
  })
})
