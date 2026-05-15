import { describe, it, expect } from 'vitest'
import { evaluateTemporalRules } from './evaluate.js'
import { createMemoryEventStore } from './store.js'
import type { TemporalRule, PipelineEvent } from './types.js'
import type { TransferAction } from '../types/action.js'

const transferAction: TransferAction = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'USDC', amount: 1000n, decimals: 6 },
  to: '0x0000000000000000000000000000000000000001',
}

function makeEvent(overrides?: Partial<PipelineEvent>): PipelineEvent {
  return {
    id: Math.random().toString(36).slice(2),
    timestamp: Date.now(),
    agentId: 'agent-1',
    chain: 'ethereum',
    action: transferAction,
    outcome: { status: 'success' },
    spendAmount: 1000n,
    ...overrides,
  }
}

describe('evaluateTemporalRules — no rules', () => {
  it('returns not triggered for empty rules', () => {
    const store = createMemoryEventStore()
    const result = evaluateTemporalRules([], store, transferAction, 'agent-1')
    expect(result.triggered).toBe(false)
  })
})

describe('simulation_failure_rate', () => {
  it('triggers when failure count meets threshold', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ outcome: { status: 'simulation_failed' } }))
    store.record(makeEvent({ outcome: { status: 'simulation_failed' } }))
    store.record(makeEvent({ outcome: { status: 'simulation_failed' } }))
    const rules: TemporalRule[] = [
      {
        predicate: {
          kind: 'simulation_failure_rate',
          windowMs: 3_600_000,
          threshold: 3,
        },
        consequence: { kind: 'require_approval' },
        label: 'sim-failure-guard',
      },
    ]
    const result = evaluateTemporalRules(rules, store, transferAction, 'agent-1')
    expect(result.triggered).toBe(true)
    expect(result.consequence?.kind).toBe('require_approval')
    expect(result.label).toBe('sim-failure-guard')
    expect(result.details).toContain('simulation failures')
  })

  it('does not trigger below threshold', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ outcome: { status: 'simulation_failed' } }))
    store.record(makeEvent({ outcome: { status: 'simulation_failed' } }))
    const rules: TemporalRule[] = [
      {
        predicate: {
          kind: 'simulation_failure_rate',
          windowMs: 3_600_000,
          threshold: 3,
        },
        consequence: { kind: 'require_approval' },
      },
    ]
    const result = evaluateTemporalRules(rules, store, transferAction, 'agent-1')
    expect(result.triggered).toBe(false)
  })

  it('scopes to agentId', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ agentId: 'agent-2', outcome: { status: 'simulation_failed' } }))
    store.record(makeEvent({ agentId: 'agent-2', outcome: { status: 'simulation_failed' } }))
    store.record(makeEvent({ agentId: 'agent-2', outcome: { status: 'simulation_failed' } }))
    const rules: TemporalRule[] = [
      {
        predicate: {
          kind: 'simulation_failure_rate',
          windowMs: 3_600_000,
          threshold: 3,
        },
        consequence: { kind: 'reject' },
      },
    ]
    const result = evaluateTemporalRules(rules, store, transferAction, 'agent-1')
    expect(result.triggered).toBe(false)
  })
})

describe('contract_call_frequency', () => {
  it('triggers when contract called too many times', () => {
    const store = createMemoryEventStore()
    const contractAction = {
      kind: 'contract_call' as const,
      chain: 'ethereum' as const,
      contract: '0xUNISWAP',
      method: 'swap',
      args: [],
    }
    for (let i = 0; i < 5; i++) {
      store.record(makeEvent({ action: contractAction }))
    }
    const rules: TemporalRule[] = [
      {
        predicate: {
          kind: 'contract_call_frequency',
          contractAddress: '0xUNISWAP',
          windowMs: 600_000,
          threshold: 5,
        },
        consequence: { kind: 'flag_for_review' },
      },
    ]
    const result = evaluateTemporalRules(rules, store, transferAction, 'agent-1')
    expect(result.triggered).toBe(true)
    expect(result.consequence?.kind).toBe('flag_for_review')
  })
})

describe('success_drought', () => {
  it('triggers when no successes in window', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ outcome: { status: 'simulation_failed' } }))
    store.record(makeEvent({ outcome: { status: 'policy_rejected' } }))
    const rules: TemporalRule[] = [
      {
        predicate: { kind: 'success_drought', windowMs: 3_600_000, threshold: 1 },
        consequence: { kind: 'reject' },
      },
    ]
    const result = evaluateTemporalRules(rules, store, transferAction, 'agent-1')
    expect(result.triggered).toBe(true)
  })

  it('does not trigger when successes exist', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ outcome: { status: 'success' } }))
    const rules: TemporalRule[] = [
      {
        predicate: { kind: 'success_drought', windowMs: 3_600_000, threshold: 1 },
        consequence: { kind: 'reject' },
      },
    ]
    const result = evaluateTemporalRules(rules, store, transferAction, 'agent-1')
    expect(result.triggered).toBe(false)
  })
})

describe('spend_velocity', () => {
  it('triggers when cumulative spend plus current exceeds limit', () => {
    const store = createMemoryEventStore()
    for (let i = 0; i < 4; i++) {
      store.record(makeEvent({ outcome: { status: 'success' }, spendAmount: 1000n }))
    }
    const rules: TemporalRule[] = [
      {
        predicate: {
          kind: 'spend_velocity',
          windowMs: 1_800_000,
          maxAmount: 5000n,
          token: 'USDC',
        },
        consequence: { kind: 'reject' },
      },
    ]
    const result = evaluateTemporalRules(rules, store, transferAction, 'agent-1')
    expect(result.triggered).toBe(true)
    expect(result.details).toContain('5000')
  })

  it('does not trigger below velocity limit', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ outcome: { status: 'success' }, spendAmount: 1000n }))
    const rules: TemporalRule[] = [
      {
        predicate: {
          kind: 'spend_velocity',
          windowMs: 1_800_000,
          maxAmount: 10_000n,
          token: 'USDC',
        },
        consequence: { kind: 'reject' },
      },
    ]
    const result = evaluateTemporalRules(rules, store, transferAction, 'agent-1')
    expect(result.triggered).toBe(false)
  })
})

describe('consecutive_failures', () => {
  it('triggers when last N events are all failures', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ outcome: { status: 'simulation_failed' } }))
    store.record(makeEvent({ outcome: { status: 'execution_failed' } }))
    store.record(makeEvent({ outcome: { status: 'policy_rejected' } }))
    const rules: TemporalRule[] = [
      {
        predicate: { kind: 'consecutive_failures', count: 3 },
        consequence: { kind: 'require_approval' },
      },
    ]
    const result = evaluateTemporalRules(rules, store, transferAction, 'agent-1')
    expect(result.triggered).toBe(true)
  })

  it('does not trigger when a success breaks the streak', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ outcome: { status: 'simulation_failed' } }))
    store.record(makeEvent({ outcome: { status: 'success' } }))
    store.record(makeEvent({ outcome: { status: 'simulation_failed' } }))
    const rules: TemporalRule[] = [
      {
        predicate: { kind: 'consecutive_failures', count: 3 },
        consequence: { kind: 'require_approval' },
      },
    ]
    const result = evaluateTemporalRules(rules, store, transferAction, 'agent-1')
    expect(result.triggered).toBe(false)
  })
})

describe('approval_flood', () => {
  it('triggers when approval timeouts exceed threshold', () => {
    const store = createMemoryEventStore()
    for (let i = 0; i < 3; i++) {
      store.record(makeEvent({ outcome: { status: 'approval_timeout' } }))
    }
    const rules: TemporalRule[] = [
      {
        predicate: { kind: 'approval_flood', windowMs: 3_600_000, threshold: 3 },
        consequence: { kind: 'reject' },
      },
    ]
    const result = evaluateTemporalRules(rules, store, transferAction, 'agent-1')
    expect(result.triggered).toBe(true)
  })
})

describe('rule ordering', () => {
  it('returns first triggered rule', () => {
    const store = createMemoryEventStore()
    store.record(makeEvent({ outcome: { status: 'simulation_failed' } }))
    store.record(makeEvent({ outcome: { status: 'simulation_failed' } }))
    store.record(makeEvent({ outcome: { status: 'simulation_failed' } }))
    const rules: TemporalRule[] = [
      {
        predicate: {
          kind: 'simulation_failure_rate',
          windowMs: 3_600_000,
          threshold: 3,
        },
        consequence: { kind: 'require_approval' },
        label: 'first-rule',
      },
      {
        predicate: {
          kind: 'simulation_failure_rate',
          windowMs: 3_600_000,
          threshold: 3,
        },
        consequence: { kind: 'reject' },
        label: 'second-rule',
      },
    ]
    const result = evaluateTemporalRules(rules, store, transferAction, 'agent-1')
    expect(result.triggered).toBe(true)
    expect(result.label).toBe('first-rule')
  })
})
