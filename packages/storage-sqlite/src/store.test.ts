import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createSqliteReceiptStore } from './store.js'
import { initSchema } from './schema.js'
import { serializeReceipt, deserializeReceipt } from './serialization.js'
import type { SuccessReceipt, TransferAction } from '@txfence/core'

function makeReceipt(overrides: Partial<SuccessReceipt> = {}): SuccessReceipt {
  const action: TransferAction = {
    kind: 'transfer',
    chain: 'ethereum',
    token: { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  }
  return {
    status: 'success',
    action,
    policyEvaluation: { passed: true, checksRun: ['checkChain'] },
    simulation: {
      success: true,
      wouldRevert: false,
      chain: 'ethereum',
      simulatedAtBlock: 1000,
      gasEstimate: 21000n,
      gasBufferApplied: 1.2,
      coverageLevel: 'basic',
      caveats: ['state_may_diverge'],
      provider: 'eth_call',
    },
    txHash: '0xabc123',
    confirmedAtBlock: 1000,
    confirmedAtMs: Date.now(),
    gasUsed: 21000n,
    ...overrides,
  }
}

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  initSchema(db)
})

// ── serializeReceipt / deserializeReceipt ─────────────────────────────────────

describe('serializeReceipt and deserializeReceipt', () => {
  it('round-trips a receipt preserving bigint fields', () => {
    const receipt = makeReceipt()
    const serialized = serializeReceipt(receipt)
    expect(typeof serialized.action).toBe('string')
    expect(serialized.gas_used).toBe('21000')
    const deserialized = deserializeReceipt(serialized as unknown as Record<string, unknown>)
    expect(deserialized.gasUsed).toBe(21000n)
    expect(typeof deserialized.gasUsed).toBe('bigint')
  })

  it('serializes simulation gasEstimate as string inside JSON', () => {
    const receipt = makeReceipt()
    const serialized = serializeReceipt(receipt)
    const sim = JSON.parse(serialized.simulation) as Record<string, unknown>
    expect(typeof sim['gasEstimate']).toBe('string')
  })

  it('deserializes simulation gasEstimate back to bigint', () => {
    const receipt = makeReceipt()
    const serialized = serializeReceipt(receipt)
    const deserialized = deserializeReceipt(serialized as unknown as Record<string, unknown>)
    expect(deserialized.simulation.gasEstimate).toBe(21000n)
  })
})

// ── createSqliteReceiptStore ──────────────────────────────────────────────────

describe('createSqliteReceiptStore', () => {
  it('saves and retrieves a receipt by txHash', async () => {
    const store = createSqliteReceiptStore(db)
    const receipt = makeReceipt()
    await store.save(receipt)
    const found = await store.get('0xabc123')
    expect(found).not.toBeNull()
    expect(found?.txHash).toBe('0xabc123')
    expect(found?.gasUsed).toBe(21000n)
  })

  it('returns null for unknown txHash', async () => {
    const store = createSqliteReceiptStore(db)
    const result = await store.get('0xunknown')
    expect(result).toBeNull()
  })

  it('lists all receipts with no filter', async () => {
    const store = createSqliteReceiptStore(db)
    await store.save(makeReceipt({ txHash: '0xaaa', confirmedAtBlock: 100 }))
    await store.save(makeReceipt({ txHash: '0xbbb', confirmedAtBlock: 200 }))
    const all = await store.list()
    expect(all).toHaveLength(2)
  })

  it('filters by chain', async () => {
    const store = createSqliteReceiptStore(db)
    await store.save(makeReceipt({ txHash: '0xevm' }))
    const solanaAction: TransferAction = {
      kind: 'transfer',
      chain: 'solana',
      token: { token: 'SOL', amount: 1000000000n, decimals: 9 },
      to: 'DummyAddress',
    }
    await store.save(makeReceipt({ txHash: '0xsol', action: solanaAction }))
    const evmOnly = await store.list({ chain: 'ethereum' })
    expect(evmOnly).toHaveLength(1)
    expect(evmOnly[0]!.txHash).toBe('0xevm')
  })

  it('filters by from block', async () => {
    const store = createSqliteReceiptStore(db)
    await store.save(makeReceipt({ txHash: '0xold', confirmedAtBlock: 100 }))
    await store.save(makeReceipt({ txHash: '0xnew', confirmedAtBlock: 200 }))
    const recent = await store.list({ from: 150 })
    expect(recent).toHaveLength(1)
    expect(recent[0]!.txHash).toBe('0xnew')
  })

  it('filters by to block', async () => {
    const store = createSqliteReceiptStore(db)
    await store.save(makeReceipt({ txHash: '0xold', confirmedAtBlock: 100 }))
    await store.save(makeReceipt({ txHash: '0xnew', confirmedAtBlock: 200 }))
    const early = await store.list({ to: 150 })
    expect(early).toHaveLength(1)
    expect(early[0]!.txHash).toBe('0xold')
  })

  it('upserts on duplicate txHash', async () => {
    const store = createSqliteReceiptStore(db)
    await store.save(makeReceipt({ txHash: '0xdup', confirmedAtBlock: 100 }))
    await store.save(makeReceipt({ txHash: '0xdup', confirmedAtBlock: 200 }))
    const all = await store.list()
    expect(all).toHaveLength(1)
    expect(all[0]!.confirmedAtBlock).toBe(200)
  })

  it('uses custom table name', async () => {
    const customDb = new Database(':memory:')
    const { initSchema: init } = await import('./schema.js')
    init(customDb, { tableName: 'my_receipts' })
    const store = createSqliteReceiptStore(customDb, { tableName: 'my_receipts' })
    await store.save(makeReceipt())
    const found = await store.get('0xabc123')
    expect(found).not.toBeNull()
  })
})

// ── initSchema ────────────────────────────────────────────────────────────────

describe('initSchema', () => {
  it('creates the table idempotently', async () => {
    initSchema(db)
    initSchema(db)
    const store = createSqliteReceiptStore(db)
    await store.save(makeReceipt())
    const found = await store.get('0xabc123')
    expect(found).not.toBeNull()
  })
})
