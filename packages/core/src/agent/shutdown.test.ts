import { describe, it, expect } from 'vitest'
import { createAgent } from './create.js'
import type { Policy } from '../types/policy.js'
import type { TransferAction } from '../types/action.js'

const basePolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'ETH', amount: 1000000000000000000n, decimals: 18 },
  allowedContracts: [],
  requireSimulation: false,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'ETH', amount: 10000000000000000000n, decimals: 18 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent',
}

const transferAction: TransferAction = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}

function makeAgent() {
  return createAgent(
    {
      chains: ['ethereum'],
      policies: basePolicy,
      signer: {
        address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        sign: async () => { throw new Error('not implemented') },
      },
    },
    {},
    {},
    undefined,
  )
}

// ── agent health ──────────────────────────────────────────────────────────────

describe('agent health', () => {
  it('returns healthy status before shutdown', () => {
    const agent = makeAgent()
    const h = agent.health()
    expect(h.status).toBe('healthy')
    expect(h.inFlight).toBe(0)
    expect(h.uptime).toBeGreaterThanOrEqual(0)
  })

  it('returns shutting_down after shutdown is called', () => {
    const agent = makeAgent()
    agent.shutdown(0)
    expect(agent.health().status).toBe('shutting_down')
    expect(agent.isShuttingDown()).toBe(true)
  })

  it('uptime increases over time', async () => {
    const agent = makeAgent()
    const h1 = agent.health()
    await new Promise(resolve => setTimeout(resolve, 10))
    const h2 = agent.health()
    expect(h2.uptime).toBeGreaterThan(h1.uptime)
  })
})

// ── agent shutdown ────────────────────────────────────────────────────────────

describe('agent shutdown', () => {
  it('returns shutdown result with completed count', async () => {
    const agent = makeAgent()
    await agent.submit({ action: transferAction, policy: basePolicy })
    const result = await agent.shutdown(1000)
    expect(result.completed).toBe(1)
    expect(result.abandoned).toBe(0)
  })

  it('rejects new submissions after shutdown', async () => {
    const agent = makeAgent()
    await agent.shutdown(0)
    await expect(
      agent.submit({ action: transferAction, policy: basePolicy }),
    ).rejects.toThrow('shutting down')
  })

  it('isShuttingDown returns false before shutdown', () => {
    const agent = makeAgent()
    expect(agent.isShuttingDown()).toBe(false)
  })

  it('isShuttingDown returns true after shutdown called', async () => {
    const agent = makeAgent()
    const shutdownPromise = agent.shutdown(100)
    expect(agent.isShuttingDown()).toBe(true)
    await shutdownPromise
  })

  it('shutdown resolves even with no in-flight submissions', async () => {
    const agent = makeAgent()
    const result = await agent.shutdown(1000)
    expect(result.completed).toBe(0)
    expect(result.abandoned).toBe(0)
  })

  it('tracks completed count across multiple submissions', async () => {
    const agent = makeAgent()
    await agent.submit({ action: transferAction, policy: basePolicy })
    await agent.submit({ action: transferAction, policy: basePolicy })
    await agent.submit({ action: transferAction, policy: basePolicy })
    const result = await agent.shutdown(1000)
    expect(result.completed).toBe(3)
  })
})

// ── agent isShuttingDown ──────────────────────────────────────────────────────

describe('agent isShuttingDown', () => {
  it('returns false initially', () => {
    const agent = makeAgent()
    expect(agent.isShuttingDown()).toBe(false)
  })
})
