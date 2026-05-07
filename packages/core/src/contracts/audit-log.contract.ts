import { describe, it, expect } from 'vitest'

// Minimal local types — avoids a circular dependency between @txfence/core and @txfence/audit.
// Method shorthand syntax is intentional: TypeScript applies bivariant parameter checking for
// method shorthands, which lets the stricter AuditLog type satisfy this interface at call sites.
type MinimalOutcome = { status: string }

type MinimalTokenAmount = { token: string; amount: bigint; decimals: number }

type MinimalEntry = {
  id: string
  timestamp: number
  action: { kind: string; chain: string }
  policySnapshot: { maxSpendPerTx: MinimalTokenAmount; humanApprovalThreshold: MinimalTokenAmount }
  evaluation: { passed: boolean; checksRun: string[] }
  outcome: MinimalOutcome
}

type MinimalFilter = {
  status?: string
  actionKind?: string
  from?: number
}

export type MinimalAuditLog = {
  record(entry: MinimalEntry): Promise<void>
  query(filter?: MinimalFilter): Promise<MinimalEntry[]>
  get(id: string): Promise<MinimalEntry | null>
}

function makeEntry(overrides: Partial<MinimalEntry> = {}): MinimalEntry {
  return {
    id: 'test-id-001',
    timestamp: 1000000,
    action: { kind: 'transfer', chain: 'ethereum' },
    policySnapshot: {
      maxSpendPerTx: { token: 'ETH', amount: 1000000000000000000n, decimals: 18 },
      humanApprovalThreshold: { token: 'ETH', amount: 10000000000000000000n, decimals: 18 },
    },
    evaluation: { passed: true, checksRun: ['checkChain'] },
    outcome: { status: 'success' },
    ...overrides,
  }
}

export function auditLogContract(name: string, createLog: () => MinimalAuditLog): void {
  describe(name, () => {
    it('records and retrieves an entry by id', async () => {
      const log = createLog()
      await log.record(makeEntry())
      const found = await log.get('test-id-001')
      expect(found).not.toBeNull()
      expect(found?.id).toBe('test-id-001')
    })

    it('returns null for unknown id', async () => {
      const log = createLog()
      expect(await log.get('unknown')).toBeNull()
    })

    it('lists all entries with no filter', async () => {
      const log = createLog()
      await log.record(makeEntry({ id: 'a', timestamp: 1000 }))
      await log.record(makeEntry({ id: 'b', timestamp: 2000 }))
      expect(await log.query()).toHaveLength(2)
    })

    it('filters by status', async () => {
      const log = createLog()
      await log.record(makeEntry({ id: 'ok', outcome: { status: 'success' } }))
      await log.record(makeEntry({ id: 'rej', outcome: { status: 'policy_rejected' } }))
      const rejected = await log.query({ status: 'policy_rejected' })
      expect(rejected).toHaveLength(1)
      expect(rejected[0]?.id).toBe('rej')
    })

    it('filters by actionKind', async () => {
      const log = createLog()
      await log.record(makeEntry({ id: 'transfer', action: { kind: 'transfer', chain: 'ethereum' } }))
      await log.record(makeEntry({ id: 'swap', action: { kind: 'swap', chain: 'ethereum' } }))
      const swaps = await log.query({ actionKind: 'swap' })
      expect(swaps).toHaveLength(1)
      expect(swaps[0]?.id).toBe('swap')
    })

    it('filters by timestamp range', async () => {
      const log = createLog()
      await log.record(makeEntry({ id: 'old', timestamp: 1000 }))
      await log.record(makeEntry({ id: 'new', timestamp: 3000 }))
      const recent = await log.query({ from: 2000 })
      expect(recent).toHaveLength(1)
      expect(recent[0]?.id).toBe('new')
    })
  })
}
