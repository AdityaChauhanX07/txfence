import { describe, it, expect } from 'vitest'
import { replayAuditLog } from './replay.js'
import type { ReplayableAuditLog } from './types.js'
import type { Policy } from '../types/policy.js'
import type { TransferAction, SwapAction } from '../types/action.js'

type MockEntry = {
  id: string
  timestamp: number
  action: TransferAction | SwapAction
  passed: boolean
  rejectionReason?: string
  status?: string
}

function makeMockAuditLog(entries: MockEntry[]): ReplayableAuditLog {
  return {
    query: async () => entries.map(e => ({
      id: e.id,
      timestamp: e.timestamp,
      action: e.action,
      evaluation: {
        passed: e.passed,
        checksRun: ['checkChain', 'checkSpend'],
        ...(e.rejectionReason !== undefined ? { rejectionReason: e.rejectionReason } : {}),
      },
      outcome: { status: e.status ?? (e.passed ? 'execution_failed' : 'policy_rejected') },
    })),
  }
}

const basePolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 6 },
  allowedContracts: [],
  requireSimulation: false,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent',
}

const stricterPolicy: Policy = {
  ...basePolicy,
  maxSpendPerTx: { token: 'USDC', amount: 500n, decimals: 6 },
}

const looserPolicy: Policy = {
  ...basePolicy,
  maxSpendPerTx: { token: 'USDC', amount: 5000n, decimals: 6 },
}

const makeTransfer = (amount: bigint): TransferAction => ({
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'USDC', amount, decimals: 6 },
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
})

describe('replayAuditLog — basic replay', () => {
  it('returns empty result for empty audit log', async () => {
    const log = makeMockAuditLog([])
    const result = await replayAuditLog(log, basePolicy)
    expect(result.entries).toHaveLength(0)
    expect(result.summary.total).toBe(0)
    expect(result.summary.skipped).toBe(0)
  })

  it('replays a passing entry that still passes', async () => {
    const log = makeMockAuditLog([{
      id: 'entry-1',
      timestamp: 1000000,
      action: makeTransfer(500n),
      passed: true,
    }])
    const result = await replayAuditLog(log, basePolicy)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]?.changed).toBe(false)
    expect(result.summary.unchanged).toBe(1)
    expect(result.summary.changed).toBe(0)
  })

  it('detects newly_rejected when policy tightens', async () => {
    const log = makeMockAuditLog([{
      id: 'entry-2',
      timestamp: 1000000,
      action: makeTransfer(800n),
      passed: true,
    }])
    const result = await replayAuditLog(log, stricterPolicy)
    expect(result.entries[0]?.changed).toBe(true)
    expect(result.entries[0]?.direction).toBe('newly_rejected')
    expect(result.summary.newlyRejected).toBe(1)
  })

  it('detects newly_allowed when policy loosens', async () => {
    const log = makeMockAuditLog([{
      id: 'entry-3',
      timestamp: 1000000,
      action: makeTransfer(800n),
      passed: false,
      rejectionReason: 'spend_exceeds_cap',
    }])
    const result = await replayAuditLog(log, looserPolicy)
    expect(result.entries[0]?.changed).toBe(true)
    expect(result.entries[0]?.direction).toBe('newly_allowed')
    expect(result.summary.newlyAllowed).toBe(1)
  })

  it('detects rejection_reason_changed', async () => {
    const log = makeMockAuditLog([{
      id: 'entry-4',
      timestamp: 1000000,
      action: makeTransfer(2000n),
      passed: false,
      rejectionReason: 'chain_not_allowed',
    }])
    const result = await replayAuditLog(log, stricterPolicy)
    expect(result.entries[0]?.changed).toBe(true)
    expect(result.entries[0]?.direction).toBe('rejection_reason_changed')
    expect(result.summary.rejectionReasonChanged).toBe(1)
  })
})

describe('replayAuditLog — options', () => {
  it('filters by timestamp range', async () => {
    let queryCalled = false
    let queryFilter: { from?: number; to?: number } | undefined
    const trackingLog: ReplayableAuditLog = {
      query: async (filter) => {
        queryCalled = true
        queryFilter = filter
        return []
      },
    }
    await replayAuditLog(trackingLog, basePolicy, { from: 2000, to: 4000 })
    expect(queryCalled).toBe(true)
    expect(queryFilter?.from).toBe(2000)
    expect(queryFilter?.to).toBe(4000)
  })

  it('filters by actionKind', async () => {
    let queryFilter: { actionKind?: string } | undefined
    const trackingLog: ReplayableAuditLog = {
      query: async (filter) => { queryFilter = filter; return [] },
    }
    await replayAuditLog(trackingLog, basePolicy, { actionKind: 'swap' })
    expect(queryFilter?.actionKind).toBe('swap')
  })

  it('onlyChanged filters out unchanged entries', async () => {
    const log = makeMockAuditLog([
      { id: 'unchanged', timestamp: 1000, action: makeTransfer(100n), passed: true },
      { id: 'changed', timestamp: 2000, action: makeTransfer(800n), passed: true },
    ])
    const result = await replayAuditLog(log, stricterPolicy, { onlyChanged: true })
    expect(result.entries.every(e => e.changed)).toBe(true)
    expect(result.entries.some(e => e.auditEntryId === 'unchanged')).toBe(false)
  })
})

describe('replayAuditLog — summary accuracy', () => {
  it('builds accurate summary across mixed results', async () => {
    const log = makeMockAuditLog([
      { id: 'pass-stays', timestamp: 1000, action: makeTransfer(100n), passed: true },
      { id: 'pass-rejected', timestamp: 2000, action: makeTransfer(800n), passed: true },
      {
        id: 'reject-stays',
        timestamp: 3000,
        action: makeTransfer(900n),
        passed: false,
        rejectionReason: 'spend_exceeds_cap',
      },
    ])
    const result = await replayAuditLog(log, stricterPolicy)
    expect(result.summary.total).toBe(3)
    expect(result.summary.unchanged).toBe(2)
    expect(result.summary.newlyRejected).toBe(1)
    expect(result.summary.changed).toBe(1)
  })

  it('records replayedAt timestamp', async () => {
    const log = makeMockAuditLog([])
    const before = Date.now()
    const result = await replayAuditLog(log, basePolicy)
    const after = Date.now()
    expect(result.replayedAt).toBeGreaterThanOrEqual(before)
    expect(result.replayedAt).toBeLessThanOrEqual(after)
  })
})
