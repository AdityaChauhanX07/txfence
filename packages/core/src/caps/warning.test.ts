import { describe, it, expect, vi } from 'vitest'
import { createMemoryCapLockProvider } from './memory.js'
import type { CapConfig, CapWarningEvent } from './provider.js'

const warningConfig: CapConfig = {
  capId: 'test-cap',
  absoluteCap: { maxAmount: 1000n, token: 'USDC' },
  warningThresholdPct: 80,
}

describe('onCapWarning — absolute cap', () => {
  it('does not fire warning below threshold', async () => {
    const onCapWarning = vi.fn()
    const provider = createMemoryCapLockProvider([warningConfig], { onCapWarning })
    await provider.acquire('test-cap', 500n, 'USDC')
    expect(onCapWarning).not.toHaveBeenCalled()
  })

  it('fires warning when projected spend crosses threshold', async () => {
    const onCapWarning = vi.fn()
    const provider = createMemoryCapLockProvider([warningConfig], { onCapWarning })
    await provider.acquire('test-cap', 850n, 'USDC')
    expect(onCapWarning).toHaveBeenCalledOnce()
    const event = onCapWarning.mock.calls[0]?.[0] as CapWarningEvent
    expect(event.capId).toBe('test-cap')
    expect(event.type).toBe('absolute')
    expect(event.capAmount).toBe(1000n)
    expect(event.pctUsed).toBeGreaterThanOrEqual(80)
    expect(event.token).toBe('USDC')
  })

  it('fires warning exactly at threshold', async () => {
    const onCapWarning = vi.fn()
    const provider = createMemoryCapLockProvider([warningConfig], { onCapWarning })
    await provider.acquire('test-cap', 800n, 'USDC')
    expect(onCapWarning).toHaveBeenCalledOnce()
  })

  it('fires warning on commit after threshold is crossed', async () => {
    const onCapWarning = vi.fn()
    const provider = createMemoryCapLockProvider([warningConfig], { onCapWarning })
    const result = await provider.acquire('test-cap', 850n, 'USDC')
    if (!result.granted) throw new Error('expected granted')
    onCapWarning.mockClear()
    await provider.commit('test-cap', result.lockId, 850n)
    expect(onCapWarning).toHaveBeenCalledOnce()
    const event = onCapWarning.mock.calls[0]?.[0] as CapWarningEvent
    expect(event.type).toBe('absolute')
  })

  it('does not fire warning when warningThresholdPct is not configured', async () => {
    const noWarningConfig: CapConfig = {
      capId: 'no-warn',
      absoluteCap: { maxAmount: 1000n, token: 'USDC' },
    }
    const onCapWarning = vi.fn()
    const provider = createMemoryCapLockProvider([noWarningConfig], { onCapWarning })
    await provider.acquire('no-warn', 999n, 'USDC')
    expect(onCapWarning).not.toHaveBeenCalled()
  })

  it('does not fire warning when no callback is provided', async () => {
    const provider = createMemoryCapLockProvider([warningConfig])
    const result = await provider.acquire('test-cap', 850n, 'USDC')
    expect(result.granted).toBe(true)
  })
})

describe('onCapWarning — rolling window', () => {
  it('fires warning when rolling window projected spend crosses threshold', async () => {
    const windowConfig: CapConfig = {
      capId: 'window-cap',
      rollingWindow: { windowMs: 3_600_000, maxAmount: 1000n, token: 'USDC' },
      warningThresholdPct: 80,
    }
    const onCapWarning = vi.fn()
    const provider = createMemoryCapLockProvider([windowConfig], { onCapWarning })
    await provider.acquire('window-cap', 850n, 'USDC')
    expect(onCapWarning).toHaveBeenCalledOnce()
    const event = onCapWarning.mock.calls[0]?.[0] as CapWarningEvent
    expect(event.type).toBe('rolling_window')
    expect(event.capAmount).toBe(1000n)
  })

  it('fires for both caps when both are configured and both cross threshold', async () => {
    const bothConfig: CapConfig = {
      capId: 'both-cap',
      absoluteCap: { maxAmount: 1000n, token: 'USDC' },
      rollingWindow: { windowMs: 3_600_000, maxAmount: 1000n, token: 'USDC' },
      warningThresholdPct: 80,
    }
    const onCapWarning = vi.fn()
    const provider = createMemoryCapLockProvider([bothConfig], { onCapWarning })
    await provider.acquire('both-cap', 850n, 'USDC')
    expect(onCapWarning).toHaveBeenCalledTimes(2)
    const types = onCapWarning.mock.calls.map((c: CapWarningEvent[]) => (c[0] as CapWarningEvent).type)
    expect(types).toContain('absolute')
    expect(types).toContain('rolling_window')
  })
})
