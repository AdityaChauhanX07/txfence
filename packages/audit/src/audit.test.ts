import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createMemoryAuditLog } from './memory.js'
import { createFileAuditLog } from './file.js'
import { clonePolicy } from './serialization.js'
import type { AuditEntry } from './types.js'
import type { TransferAction, Policy } from '@txfence/core'

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  const action: TransferAction = {
    kind: 'transfer',
    chain: 'ethereum',
    token: { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  }
  const policy: Policy = {
    chains: ['ethereum'],
    maxSpendPerTx: { token: 'ETH', amount: 1000000000000000000n, decimals: 18 },
    allowedContracts: [],
    requireSimulation: false,
    gasBufferMultiplier: 1.2,
    humanApprovalThreshold: { token: 'ETH', amount: 10000000000000000000n, decimals: 18 },
    humanApprovalTimeoutMs: 30000,
    capLockMode: 'per-agent',
  }
  return {
    id: 'test-id-001',
    timestamp: 1000000,
    action,
    policySnapshot: policy,
    evaluation: { passed: true, checksRun: ['checkChain'] },
    outcome: { status: 'success', txHash: '0xabc', confirmedAtBlock: 1000, gasUsed: '21000' },
    ...overrides,
  }
}

// ── createMemoryAuditLog ───────────────────────────────────────────────────────

describe('createMemoryAuditLog', () => {
  it('records and retrieves an entry by id', async () => {
    const log = createMemoryAuditLog()
    await log.record(makeEntry())
    const found = await log.get('test-id-001')
    expect(found).not.toBeNull()
    expect(found?.id).toBe('test-id-001')
  })

  it('returns null for unknown id', async () => {
    const log = createMemoryAuditLog()
    expect(await log.get('unknown')).toBeNull()
  })

  it('lists all entries with no filter', async () => {
    const log = createMemoryAuditLog()
    await log.record(makeEntry({ id: 'a', timestamp: 1000 }))
    await log.record(makeEntry({ id: 'b', timestamp: 2000 }))
    const all = await log.query()
    expect(all).toHaveLength(2)
  })

  it('filters by status', async () => {
    const log = createMemoryAuditLog()
    await log.record(makeEntry({ id: 'ok', outcome: { status: 'success', txHash: '0x1', confirmedAtBlock: 1, gasUsed: '21000' } }))
    await log.record(makeEntry({ id: 'rej', outcome: { status: 'policy_rejected', reason: 'chain_not_allowed' } }))
    const rejected = await log.query({ status: 'policy_rejected' })
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.id).toBe('rej')
  })

  it('filters by actionKind', async () => {
    const swapEntry = makeEntry({
      id: 'swap',
      action: { kind: 'swap', chain: 'ethereum', from: { token: 'ETH', amount: 1n, decimals: 18 }, to: 'USDC', via: '0xROUTER', maxSlippage: 50 },
    })
    const log = createMemoryAuditLog()
    await log.record(makeEntry({ id: 'transfer' }))
    await log.record(swapEntry)
    const swaps = await log.query({ actionKind: 'swap' })
    expect(swaps).toHaveLength(1)
    expect(swaps[0]?.id).toBe('swap')
  })

  it('filters by timestamp range', async () => {
    const log = createMemoryAuditLog()
    await log.record(makeEntry({ id: 'old', timestamp: 1000 }))
    await log.record(makeEntry({ id: 'new', timestamp: 3000 }))
    const recent = await log.query({ from: 2000 })
    expect(recent).toHaveLength(1)
    expect(recent[0]?.id).toBe('new')
  })

  it('clones the policy on record so mutations do not affect stored entry', async () => {
    const log = createMemoryAuditLog()
    const entry = makeEntry()
    const originalAmount = entry.policySnapshot.maxSpendPerTx.amount
    await log.record(entry)
    entry.policySnapshot.maxSpendPerTx.amount = 999n
    const found = await log.get('test-id-001')
    expect(found?.policySnapshot.maxSpendPerTx.amount).toBe(originalAmount)
  })
})

// ── createFileAuditLog ────────────────────────────────────────────────────────

const TMP_DIR = 'src/__test_tmp_audit__'
const TMP_FILE = join(TMP_DIR, 'audit.jsonl')

describe('createFileAuditLog', () => {
  beforeEach(() => { mkdirSync(TMP_DIR, { recursive: true }) })
  afterEach(() => { rmSync(TMP_DIR, { recursive: true, force: true }) })

  it('records and retrieves an entry by id', async () => {
    const log = createFileAuditLog(TMP_FILE)
    await log.record(makeEntry())
    const found = await log.get('test-id-001')
    expect(found).not.toBeNull()
    expect(found?.id).toBe('test-id-001')
  })

  it('returns null for unknown id when file exists', async () => {
    const log = createFileAuditLog(TMP_FILE)
    await log.record(makeEntry())
    expect(await log.get('unknown')).toBeNull()
  })

  it('returns null when file does not exist', async () => {
    const log = createFileAuditLog(TMP_FILE + '.nonexistent')
    expect(await log.get('any')).toBeNull()
  })

  it('preserves bigint fields through serialization round-trip', async () => {
    const log = createFileAuditLog(TMP_FILE)
    await log.record(makeEntry())
    const found = await log.get('test-id-001')
    if (found === null || found.action.kind !== 'transfer') throw new Error('unexpected entry')
    const action = found.action as TransferAction
    expect(action.token.amount).toBe(100000000000000000n)
    expect(found.policySnapshot.maxSpendPerTx.amount).toBe(1000000000000000000n)
  })

  it('lists multiple entries from file', async () => {
    const log = createFileAuditLog(TMP_FILE)
    await log.record(makeEntry({ id: 'a', timestamp: 1000 }))
    await log.record(makeEntry({ id: 'b', timestamp: 2000 }))
    const all = await log.query()
    expect(all).toHaveLength(2)
  })

  it('filters by status from file', async () => {
    const log = createFileAuditLog(TMP_FILE)
    await log.record(makeEntry({ id: 'ok' }))
    await log.record(makeEntry({ id: 'rej', outcome: { status: 'policy_rejected', reason: 'chain_not_allowed' } }))
    const rejected = await log.query({ status: 'policy_rejected' })
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.id).toBe('rej')
  })
})

// ── clonePolicy ───────────────────────────────────────────────────────────────

describe('clonePolicy', () => {
  it('deep clones bigint fields correctly', () => {
    const policy: Policy = {
      chains: ['ethereum'],
      maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 6 },
      allowedContracts: [],
      requireSimulation: false,
      gasBufferMultiplier: 1.2,
      humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
      humanApprovalTimeoutMs: 30000,
      capLockMode: 'per-agent',
    }
    const cloned = clonePolicy(policy)
    expect(cloned.maxSpendPerTx.amount).toBe(1000n)
    expect(typeof cloned.maxSpendPerTx.amount).toBe('bigint')
    cloned.maxSpendPerTx.amount = 999n
    expect(policy.maxSpendPerTx.amount).toBe(1000n)
  })
})
