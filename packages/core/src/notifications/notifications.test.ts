import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createConsoleNotificationProvider } from './console.js'
import { createCompositeNotificationProvider } from './composite.js'
import { createWebhookNotificationProvider } from './webhook.js'
import type { NotificationEvent } from './types.js'

const policyRejectedEvent: NotificationEvent = {
  kind: 'policy_rejected',
  action: { kind: 'transfer', chain: 'ethereum', token: { token: 'ETH', amount: 1n, decimals: 18 }, to: '0xabc' },
  reason: 'chain_not_allowed',
  evaluation: { passed: false, checksRun: ['checkChain'], rejectionReason: 'chain_not_allowed' },
}

const executionSuccessEvent: NotificationEvent = {
  kind: 'execution_success',
  receipt: {
    status: 'success',
    action: { kind: 'transfer', chain: 'ethereum', token: { token: 'ETH', amount: 1n, decimals: 18 }, to: '0xabc' },
    policyEvaluation: { passed: true, checksRun: ['checkChain'] },
    simulation: {
      success: true, wouldRevert: false, chain: 'ethereum', simulatedAtBlock: 100,
      gasEstimate: 21000n, gasBufferApplied: 1.2, coverageLevel: 'basic', caveats: [], provider: 'eth_call',
    },
    txHash: '0xdeadbeef',
    confirmedAtBlock: 101,
    confirmedAtMs: Date.now(),
    gasUsed: 21000n,
  },
}

const monitorUnrecordedEvent: NotificationEvent = {
  kind: 'monitor_unrecorded',
  chain: 'ethereum',
  txHash: '0x1234',
  fromAddress: '0xfrom',
  toAddress: '0xto',
  value: '1000000000000000000',
  blockNumber: 500,
  detectedAt: Date.now(),
  severity: 'warning',
}

const monitorReorgEvent: NotificationEvent = {
  kind: 'monitor_reorg',
  chain: 'ethereum',
  txHash: '0x5678',
  originalBlock: 450,
  detectedAt: Date.now(),
}

// ── console provider ──────────────────────────────────────────────────────────

describe('createConsoleNotificationProvider', () => {
  it('calls console.log for policy_rejected', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const provider = createConsoleNotificationProvider()
    await provider.notify(policyRejectedEvent)
    expect(logSpy).toHaveBeenCalledOnce()
    expect(logSpy.mock.calls[0]?.[0]).toContain('policy_rejected')
    logSpy.mockRestore()
  })

  it('uses custom prefix in output', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const provider = createConsoleNotificationProvider({ prefix: '[MY-APP]' })
    await provider.notify(policyRejectedEvent)
    expect(logSpy.mock.calls[0]?.[0]).toContain('[MY-APP]')
    logSpy.mockRestore()
  })

  it('uses warn log level when configured', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const provider = createConsoleNotificationProvider({ logLevel: 'warn' })
    await provider.notify(monitorUnrecordedEvent)
    expect(warnSpy).toHaveBeenCalledOnce()
    warnSpy.mockRestore()
  })

  it('includes txHash in monitor_reorg output', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const provider = createConsoleNotificationProvider()
    await provider.notify(monitorReorgEvent)
    expect(logSpy.mock.calls[0]?.[0]).toContain('0x5678')
    logSpy.mockRestore()
  })

  it('includes txHash in execution_success output', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const provider = createConsoleNotificationProvider()
    await provider.notify(executionSuccessEvent)
    expect(logSpy.mock.calls[0]?.[0]).toContain('0xdeadbeef')
    logSpy.mockRestore()
  })
})

// ── composite provider ────────────────────────────────────────────────────────

describe('createCompositeNotificationProvider', () => {
  it('notifies all child providers', async () => {
    const a = { notify: vi.fn().mockResolvedValue(undefined) }
    const b = { notify: vi.fn().mockResolvedValue(undefined) }
    const composite = createCompositeNotificationProvider(a, b)
    await composite.notify(policyRejectedEvent)
    expect(a.notify).toHaveBeenCalledOnce()
    expect(b.notify).toHaveBeenCalledOnce()
  })

  it('passes the same event to all providers', async () => {
    const received: NotificationEvent[] = []
    const a = { notify: vi.fn((e: NotificationEvent) => { received.push(e); return Promise.resolve() }) }
    const composite = createCompositeNotificationProvider(a)
    await composite.notify(monitorReorgEvent)
    expect(received[0]).toBe(monitorReorgEvent)
  })

  it('works with zero providers', async () => {
    const composite = createCompositeNotificationProvider()
    await expect(composite.notify(policyRejectedEvent)).resolves.toBeUndefined()
  })
})

// ── webhook provider ──────────────────────────────────────────────────────────

describe('createWebhookNotificationProvider', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('POSTs to the configured URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }))
    const provider = createWebhookNotificationProvider('https://hooks.example.com/events')
    await provider.notify(policyRejectedEvent)
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://hooks.example.com/events')
    expect(init.method).toBe('POST')
  })

  it('sets x-txfence-event header to event kind', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }))
    const provider = createWebhookNotificationProvider('https://hooks.example.com/events')
    await provider.notify(policyRejectedEvent)
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['x-txfence-event']).toBe('policy_rejected')
  })

  it('includes HMAC signature when secret is provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }))
    const provider = createWebhookNotificationProvider('https://hooks.example.com/events', { secret: 'my-secret' })
    await provider.notify(policyRejectedEvent)
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const sig = (init.headers as Record<string, string>)['x-txfence-signature']
    expect(sig).toBeDefined()
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })
})
