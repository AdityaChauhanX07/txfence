import { describe, it, expect, vi } from 'vitest'
import { runPipeline } from '../agent/pipeline.js'
import { createMemoryEventStore } from './store.js'
import type { Policy } from '../types/policy.js'
import type { TransferAction } from '../types/action.js'
import type { TemporalRule } from './types.js'
import type { SuccessReceipt } from '../types/receipt.js'

const basePolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'USDC', amount: 10000n, decimals: 6 },
  allowedContracts: [],
  requireSimulation: false,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 100000n, decimals: 6 },
  humanApprovalTimeoutMs: 100,
  capLockMode: 'per-agent',
}

const transfer: TransferAction = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'USDC', amount: 1000n, decimals: 6 },
  to: '0x0000000000000000000000000000000000000001',
}

const makeReceipt = (): SuccessReceipt => ({
  status: 'success',
  action: transfer,
  policyEvaluation: { passed: true, checksRun: [] },
  simulation: {
    success: true,
    wouldRevert: false,
    chain: 'ethereum',
    simulatedAtBlock: 1000,
    gasEstimate: 21000n,
    gasBufferApplied: 1.2,
    coverageLevel: 'basic',
    caveats: [],
    provider: 'eth_call',
  },
  txHash: '0xmock',
  confirmedAtBlock: 1000,
  confirmedAtMs: Date.now(),
  gasUsed: 21000n,
})

describe('pipeline temporal integration', () => {
  it('records successful transactions in the event store', async () => {
    const store = createMemoryEventStore()
    const executor = vi.fn().mockResolvedValue(makeReceipt())
    await runPipeline(
      transfer,
      basePolicy,
      {},
      { ethereum: 'http://mock' },
      executor,
      undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined,
      store,
      'agent-test',
    )
    const events = store.query()
    expect(events.length).toBeGreaterThan(0)
    expect(events.some(e => e.outcome.status === 'success')).toBe(true)
  })

  it('records policy_rejected events in the event store', async () => {
    const store = createMemoryEventStore()
    const restrictivePolicy: Policy = {
      ...basePolicy,
      chains: ['solana'],
    }
    await runPipeline(
      transfer,
      restrictivePolicy,
      {},
      {},
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined,
      store,
      'agent-test',
    )
    const events = store.query()
    expect(events.some(e => e.outcome.status === 'policy_rejected')).toBe(true)
  })

  it('applies temporal reject rule and returns policy_rejected', async () => {
    const store = createMemoryEventStore()
    for (let i = 0; i < 3; i++) {
      store.record({
        id: `pre-${i}`,
        timestamp: Date.now(),
        agentId: 'agent-test',
        chain: 'ethereum',
        action: transfer,
        outcome: { status: 'simulation_failed' },
      })
    }
    const rule: TemporalRule = {
      predicate: {
        kind: 'simulation_failure_rate',
        windowMs: 3_600_000,
        threshold: 3,
      },
      consequence: { kind: 'reject' },
      label: 'sim-failure-guard',
    }
    const temporalPolicy: Policy = {
      ...basePolicy,
      temporalRules: [rule],
    }
    const result = await runPipeline(
      transfer,
      temporalPolicy,
      {},
      {},
      undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined,
      store,
      'agent-test',
    )
    expect(result.status).toBe('policy_rejected')
    if (result.status === 'policy_rejected') {
      expect(result.evaluation.rejectionReason).toBe('temporal_rule_triggered')
    }
  })

  it('does not apply temporal rules when no eventStore provided', async () => {
    const rule: TemporalRule = {
      predicate: {
        kind: 'simulation_failure_rate',
        windowMs: 3_600_000,
        threshold: 1,
      },
      consequence: { kind: 'reject' },
    }
    const temporalPolicy: Policy = {
      ...basePolicy,
      temporalRules: [rule],
    }
    const executor = vi.fn().mockResolvedValue(makeReceipt())
    const result = await runPipeline(
      transfer,
      temporalPolicy,
      {},
      { ethereum: 'http://mock' },
      executor,
    )
    // Without eventStore, temporal rules cannot fire — executor runs, success expected.
    const isTemporalRejection =
      result.status === 'policy_rejected' &&
      result.evaluation.rejectionReason === 'temporal_rule_triggered'
    expect(isTemporalRejection).toBe(false)
  })

  it('scopes temporal rules to agentId', async () => {
    const store = createMemoryEventStore()
    for (let i = 0; i < 3; i++) {
      store.record({
        id: `other-${i}`,
        timestamp: Date.now(),
        agentId: 'agent-other',
        chain: 'ethereum',
        action: transfer,
        outcome: { status: 'simulation_failed' },
      })
    }
    const rule: TemporalRule = {
      predicate: {
        kind: 'simulation_failure_rate',
        windowMs: 3_600_000,
        threshold: 3,
      },
      consequence: { kind: 'reject' },
    }
    const temporalPolicy: Policy = {
      ...basePolicy,
      temporalRules: [rule],
    }
    const executor = vi.fn().mockResolvedValue(makeReceipt())
    const result = await runPipeline(
      transfer,
      temporalPolicy,
      {},
      { ethereum: 'http://mock' },
      executor,
      undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined,
      store,
      'agent-test',
    )
    const isTemporalRejection =
      result.status === 'policy_rejected' &&
      result.evaluation.rejectionReason === 'temporal_rule_triggered'
    expect(isTemporalRejection).toBe(false)
  })
})
