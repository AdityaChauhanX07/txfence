import { describe, it, expect } from 'vitest'
import { createMemoryEventStore } from './store.js'
import type { PipelineEvent } from './types.js'

function makeEvent(overrides?: Partial<PipelineEvent>): PipelineEvent {
  return {
    id: Math.random().toString(36).slice(2),
    timestamp: Date.now(),
    agentId: 'agent-1',
    chain: 'ethereum',
    action: {
      kind: 'transfer',
      chain: 'ethereum',
      token: { token: 'USDC', amount: 1000n, decimals: 6 },
      to: '0x0000000000000000000000000000000000000001',
    },
    outcome: { status: 'success' },
    spendAmount: 1000n,
    ...overrides,
  }
}

describe('createMemoryEventStore — record and query', () => {
  it('records and retrieves events', () => {
    const store = createMemoryEventStore()
    const e = makeEvent()
    store.record(e)
    const results = store.query()
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe(e.id)
  })

  it('queries by agentId', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ agentId: 'agent-1' }))
    store.record(makeEvent({ agentId: 'agent-2' }))
    const results = store.query({ agentId: 'agent-1' })
    expect(results).toHaveLength(1)
    expect(results[0]?.agentId).toBe('agent-1')
  })

  it('queries by status', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ outcome: { status: 'success' } }))
    store.record(makeEvent({ outcome: { status: 'simulation_failed' } }))
    const results = store.query({ status: 'simulation_failed' })
    expect(results).toHaveLength(1)
    expect(results[0]?.outcome.status).toBe('simulation_failed')
  })

  it('queries by chain', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ chain: 'ethereum' }))
    store.record(
      makeEvent({
        chain: 'arbitrum',
        action: {
          kind: 'transfer',
          chain: 'arbitrum',
          token: { token: 'USDC', amount: 1000n, decimals: 6 },
          to: '0x0000000000000000000000000000000000000001',
        },
      }),
    )
    const results = store.query({ chain: 'arbitrum' })
    expect(results).toHaveLength(1)
  })

  it('queries by windowMs', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ timestamp: Date.now() - 10000 }))
    store.record(makeEvent({ timestamp: Date.now() }))
    const results = store.query({ windowMs: 5000 })
    expect(results).toHaveLength(1)
  })

  it('queries by contractAddress', () => {
    const store = createMemoryEventStore()
    store.record(
      makeEvent({
        action: {
          kind: 'contract_call',
          chain: 'ethereum',
          contract: '0xUNISWAP',
          method: 'swap',
          args: [],
        },
      }),
    )
    store.record(makeEvent())
    const results = store.query({ contractAddress: '0xUNISWAP' })
    expect(results).toHaveLength(1)
  })

  it('returns empty for no match', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ agentId: 'agent-1' }))
    expect(store.query({ agentId: 'agent-99' })).toHaveLength(0)
  })
})

describe('createMemoryEventStore — recent', () => {
  it('returns N most recent events newest first', () => {
    const store = createMemoryEventStore()
    const now = Date.now()
    const e1 = makeEvent({ timestamp: now - 3000, id: 'e1' })
    const e2 = makeEvent({ timestamp: now - 2000, id: 'e2' })
    const e3 = makeEvent({ timestamp: now - 1000, id: 'e3' })
    store.record(e1)
    store.record(e2)
    store.record(e3)
    const results = store.recent(2)
    expect(results).toHaveLength(2)
    expect(results[0]?.id).toBe('e3')
    expect(results[1]?.id).toBe('e2')
  })

  it('returns all events if n > count', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent())
    expect(store.recent(10)).toHaveLength(1)
  })

  it('filters recent by agentId', () => {
    const store = createMemoryEventStore()
    const now = Date.now()
    store.record(makeEvent({ agentId: 'agent-1', timestamp: now - 3000 }))
    store.record(makeEvent({ agentId: 'agent-2', timestamp: now - 2000 }))
    store.record(makeEvent({ agentId: 'agent-1', timestamp: now - 1000 }))
    const results = store.recent(5, { agentId: 'agent-1' })
    expect(results).toHaveLength(2)
    expect(results.every(e => e.agentId === 'agent-1')).toBe(true)
  })
})

describe('createMemoryEventStore — prune', () => {
  it('prunes events older than timestamp', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ timestamp: 1000, id: 'old' }))
    store.record(makeEvent({ timestamp: Date.now(), id: 'new' }))
    store.prune(Date.now() - 1000)
    const results = store.query()
    expect(results.some(e => e.id === 'old')).toBe(false)
    expect(results.some(e => e.id === 'new')).toBe(true)
  })

  it('auto-prunes when maxEvents exceeded', () => {
    const store = createMemoryEventStore({ maxEvents: 3 })
    store.record(makeEvent({ id: 'e1' }))
    store.record(makeEvent({ id: 'e2' }))
    store.record(makeEvent({ id: 'e3' }))
    store.record(makeEvent({ id: 'e4' }))
    const results = store.query()
    expect(results.length).toBeLessThanOrEqual(3)
    expect(results.some(e => e.id === 'e4')).toBe(true)
  })
})
