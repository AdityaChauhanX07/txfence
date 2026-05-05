import { describe, it, expect, vi } from 'vitest'
import { createPgReceiptStore } from './store.js'
import { serializeReceipt, deserializeReceipt } from './serialization.js'
import { initSchema } from './schema.js'
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

function makeMockPool(queryResult: { rows: unknown[] } = { rows: [] }) {
  return {
    query: vi.fn().mockResolvedValue(queryResult),
  }
}

// ── serializeReceipt / deserializeReceipt ─────────────────────────────────────

describe('serializeReceipt and deserializeReceipt', () => {
  it('round-trips a receipt preserving bigint fields', () => {
    const receipt = makeReceipt()
    const serialized = serializeReceipt(receipt)
    expect(serialized['gas_used']).toBe('21000')
    expect(typeof serialized['gas_used']).toBe('string')
    const deserialized = deserializeReceipt(serialized as Record<string, unknown>)
    expect(deserialized.gasUsed).toBe(21000n)
    expect(typeof deserialized.gasUsed).toBe('bigint')
  })

  it('serializes gasEstimate in simulation as string', () => {
    const receipt = makeReceipt()
    const serialized = serializeReceipt(receipt)
    const sim = serialized['simulation'] as Record<string, unknown>
    expect(typeof sim['gasEstimate']).toBe('string')
  })

  it('deserializes gasEstimate back to bigint', () => {
    const receipt = makeReceipt()
    const serialized = serializeReceipt(receipt)
    const deserialized = deserializeReceipt(serialized as Record<string, unknown>)
    expect(deserialized.simulation.gasEstimate).toBe(21000n)
  })
})

// ── createPgReceiptStore ──────────────────────────────────────────────────────

describe('createPgReceiptStore', () => {
  it('calls pool.query on save', async () => {
    const pool = makeMockPool()
    const store = createPgReceiptStore(pool as unknown as import('pg').Pool)
    await store.save(makeReceipt())
    expect(pool.query).toHaveBeenCalledOnce()
  })

  it('passes correct tx_hash parameter on save', async () => {
    const pool = makeMockPool()
    const store = createPgReceiptStore(pool as unknown as import('pg').Pool)
    const receipt = makeReceipt({ txHash: '0xdeadbeef' })
    await store.save(receipt)
    const callArgs = pool.query.mock.calls[0] as [string, unknown[]]
    expect(callArgs[1][0]).toBe('0xdeadbeef')
  })

  it('returns null from get when no rows returned', async () => {
    const pool = makeMockPool({ rows: [] })
    const store = createPgReceiptStore(pool as unknown as import('pg').Pool)
    const result = await store.get('0xunknown')
    expect(result).toBeNull()
  })

  it('calls pool.query with correct tx_hash on get', async () => {
    const pool = makeMockPool({ rows: [] })
    const store = createPgReceiptStore(pool as unknown as import('pg').Pool)
    await store.get('0xabc')
    const callArgs = pool.query.mock.calls[0] as [string, unknown[]]
    expect(callArgs[1][0]).toBe('0xabc')
  })

  it('returns deserialized receipt from get when row exists', async () => {
    const receipt = makeReceipt()
    const serialized = serializeReceipt(receipt)
    const pool = makeMockPool({ rows: [serialized] })
    const store = createPgReceiptStore(pool as unknown as import('pg').Pool)
    const result = await store.get('0xabc123')
    expect(result).not.toBeNull()
    expect(result?.txHash).toBe('0xabc123')
    expect(result?.gasUsed).toBe(21000n)
  })

  it('returns empty array from list when no rows', async () => {
    const pool = makeMockPool({ rows: [] })
    const store = createPgReceiptStore(pool as unknown as import('pg').Pool)
    const results = await store.list()
    expect(results).toHaveLength(0)
  })

  it('uses custom table name when provided', async () => {
    const pool = makeMockPool()
    const store = createPgReceiptStore(pool as unknown as import('pg').Pool, { tableName: 'my_receipts' })
    await store.save(makeReceipt())
    const callArgs = pool.query.mock.calls[0] as [string, unknown[]]
    expect(callArgs[0]).toContain('my_receipts')
  })
})

// ── initSchema ────────────────────────────────────────────────────────────────

describe('initSchema', () => {
  it('calls pool.query with CREATE TABLE statement', async () => {
    const pool = makeMockPool()
    await initSchema(pool as unknown as import('pg').Pool)
    expect(pool.query).toHaveBeenCalledOnce()
    const callArgs = pool.query.mock.calls[0] as [string]
    expect(callArgs[0]).toContain('CREATE TABLE IF NOT EXISTS')
    expect(callArgs[0]).toContain('txfence_receipts')
  })

  it('uses custom table name in schema creation', async () => {
    const pool = makeMockPool()
    await initSchema(pool as unknown as import('pg').Pool, { tableName: 'custom_receipts' })
    const callArgs = pool.query.mock.calls[0] as [string]
    expect(callArgs[0]).toContain('custom_receipts')
  })
})
