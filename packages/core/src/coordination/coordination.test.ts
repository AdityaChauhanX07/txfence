import { describe, it, expect } from 'vitest'
import { createMemoryAgentCoordinator } from './memory.js'
import { getIntentId, getIntentIdWithNonce } from './intent.js'
import type { TransferAction } from '../types/action.js'

const transferAction: TransferAction = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}

// ── registration ──────────────────────────────────────────────────────────────

describe('createMemoryAgentCoordinator — registration', () => {
  it('registers agents and lists them', () => {
    const coordinator = createMemoryAgentCoordinator()
    coordinator.registerAgent({ agentId: 'agent-1', priority: 10 })
    coordinator.registerAgent({ agentId: 'agent-2', priority: 5 })
    const agents = coordinator.getRegisteredAgents()
    expect(agents).toHaveLength(2)
    expect(agents.some(a => a.agentId === 'agent-1')).toBe(true)
  })
})

// ── intent claiming ───────────────────────────────────────────────────────────

describe('createMemoryAgentCoordinator — intent claiming', () => {
  it('grants claim to first agent', async () => {
    const coordinator = createMemoryAgentCoordinator()
    const result = await coordinator.claimIntent('intent-1', 'agent-1')
    expect(result.claimed).toBe(true)
    if (result.claimed) {
      expect(result.claimId).toBeTruthy()
    }
  })

  it('denies claim to second agent when first holds it', async () => {
    const coordinator = createMemoryAgentCoordinator()
    await coordinator.claimIntent('intent-2', 'agent-1', 60000)
    const result = await coordinator.claimIntent('intent-2', 'agent-2')
    expect(result.claimed).toBe(false)
    if (!result.claimed) {
      expect(result.claimedBy).toBe('agent-1')
      expect(result.expiresAt).toBeGreaterThan(Date.now())
    }
  })

  it('allows same agent to re-claim and refresh TTL', async () => {
    const coordinator = createMemoryAgentCoordinator()
    const r1 = await coordinator.claimIntent('intent-3', 'agent-1', 60000)
    const r2 = await coordinator.claimIntent('intent-3', 'agent-1', 60000)
    expect(r1.claimed).toBe(true)
    expect(r2.claimed).toBe(true)
  })

  it('releases claim and allows re-claim by another agent', async () => {
    const coordinator = createMemoryAgentCoordinator()
    await coordinator.claimIntent('intent-4', 'agent-1', 60000)
    await coordinator.releaseIntent('intent-4', 'agent-1')
    const result = await coordinator.claimIntent('intent-4', 'agent-2')
    expect(result.claimed).toBe(true)
  })

  it('grants claim after TTL expires', async () => {
    const coordinator = createMemoryAgentCoordinator()
    await coordinator.claimIntent('intent-5', 'agent-1', 0)
    await new Promise(r => setTimeout(r, 5))
    const result = await coordinator.claimIntent('intent-5', 'agent-2')
    expect(result.claimed).toBe(true)
  })

  it('does not release claim held by different agent', async () => {
    const coordinator = createMemoryAgentCoordinator()
    await coordinator.claimIntent('intent-6', 'agent-1', 60000)
    await coordinator.releaseIntent('intent-6', 'agent-2')
    const result = await coordinator.claimIntent('intent-6', 'agent-3')
    expect(result.claimed).toBe(false)
  })
})

// ── priority ──────────────────────────────────────────────────────────────────

describe('createMemoryAgentCoordinator — priority', () => {
  it('returns positive when agentA has higher priority', () => {
    const coordinator = createMemoryAgentCoordinator()
    coordinator.registerAgent({ agentId: 'high', priority: 10 })
    coordinator.registerAgent({ agentId: 'low', priority: 1 })
    expect(coordinator.comparePriority('high', 'low')).toBeGreaterThan(0)
  })

  it('returns negative when agentA has lower priority', () => {
    const coordinator = createMemoryAgentCoordinator()
    coordinator.registerAgent({ agentId: 'high', priority: 10 })
    coordinator.registerAgent({ agentId: 'low', priority: 1 })
    expect(coordinator.comparePriority('low', 'high')).toBeLessThan(0)
  })

  it('returns 0 for equal priority', () => {
    const coordinator = createMemoryAgentCoordinator()
    coordinator.registerAgent({ agentId: 'a', priority: 5 })
    coordinator.registerAgent({ agentId: 'b', priority: 5 })
    expect(coordinator.comparePriority('a', 'b')).toBe(0)
  })

  it('defaults to priority 0 for unregistered agents', () => {
    const coordinator = createMemoryAgentCoordinator()
    expect(coordinator.comparePriority('unknown-a', 'unknown-b')).toBe(0)
  })
})

// ── rate limiting ─────────────────────────────────────────────────────────────

describe('createMemoryAgentCoordinator — rate limiting', () => {
  it('is not rate limited when no config set', async () => {
    const coordinator = createMemoryAgentCoordinator()
    coordinator.registerAgent({ agentId: 'unlimited' })
    expect(await coordinator.isRateLimited('unlimited')).toBe(false)
  })

  it('is not rate limited below the threshold', async () => {
    const coordinator = createMemoryAgentCoordinator()
    coordinator.registerAgent({
      agentId: 'rate-agent',
      maxTransactionsPerWindow: { count: 5, windowMs: 60000 },
    })
    await coordinator.recordTransaction('rate-agent')
    await coordinator.recordTransaction('rate-agent')
    expect(await coordinator.isRateLimited('rate-agent')).toBe(false)
  })

  it('is rate limited at or above the threshold', async () => {
    const coordinator = createMemoryAgentCoordinator()
    coordinator.registerAgent({
      agentId: 'limited-agent',
      maxTransactionsPerWindow: { count: 3, windowMs: 60000 },
    })
    await coordinator.recordTransaction('limited-agent')
    await coordinator.recordTransaction('limited-agent')
    await coordinator.recordTransaction('limited-agent')
    expect(await coordinator.isRateLimited('limited-agent')).toBe(true)
  })

  it('counts only transactions within the window', async () => {
    const coordinator = createMemoryAgentCoordinator()
    coordinator.registerAgent({
      agentId: 'window-agent',
      maxTransactionsPerWindow: { count: 2, windowMs: 100 },
    })
    await coordinator.recordTransaction('window-agent')
    await coordinator.recordTransaction('window-agent')
    expect(await coordinator.isRateLimited('window-agent')).toBe(true)
    await new Promise(r => setTimeout(r, 110))
    expect(await coordinator.isRateLimited('window-agent')).toBe(false)
  })

  it('getTransactionCount returns correct count', async () => {
    const coordinator = createMemoryAgentCoordinator()
    await coordinator.recordTransaction('count-agent')
    await coordinator.recordTransaction('count-agent')
    const count = await coordinator.getTransactionCount('count-agent', 60000)
    expect(count).toBe(2)
  })
})

// ── getIntentId ───────────────────────────────────────────────────────────────

describe('getIntentId', () => {
  it('returns a 32-character hex string', () => {
    const id = getIntentId(transferAction)
    expect(id).toHaveLength(32)
    expect(id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('returns same id for same action', () => {
    expect(getIntentId(transferAction)).toBe(getIntentId(transferAction))
  })

  it('returns different ids for different actions', () => {
    const otherAction: TransferAction = {
      ...transferAction,
      to: '0x000000000000000000000000000000000000dead',
    }
    expect(getIntentId(transferAction)).not.toBe(getIntentId(otherAction))
  })

  it('handles bigint fields without throwing', () => {
    expect(() => getIntentId(transferAction)).not.toThrow()
  })
})

// ── getIntentIdWithNonce ──────────────────────────────────────────────────────

describe('getIntentIdWithNonce', () => {
  it('returns different id for same action with different nonce', () => {
    const id1 = getIntentIdWithNonce(transferAction, 'nonce-1')
    const id2 = getIntentIdWithNonce(transferAction, 'nonce-2')
    expect(id1).not.toBe(id2)
  })

  it('returns same id for same action and same nonce', () => {
    expect(getIntentIdWithNonce(transferAction, 'abc'))
      .toBe(getIntentIdWithNonce(transferAction, 'abc'))
  })
})
