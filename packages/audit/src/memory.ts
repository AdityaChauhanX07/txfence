import type { AuditLog, AuditEntry, AuditFilter } from './types.js'
import { clonePolicy } from './serialization.js'

export function createMemoryAuditLog(): AuditLog {
  const entries: AuditEntry[] = []

  return {
    record(entry: AuditEntry): Promise<void> {
      const cloned: AuditEntry = {
        ...entry,
        policySnapshot: clonePolicy(entry.policySnapshot),
      }
      entries.push(cloned)
      return Promise.resolve()
    },

    query(filter?: AuditFilter): Promise<AuditEntry[]> {
      let results = entries as AuditEntry[]

      if (filter?.chain !== undefined) {
        const chain = filter.chain
        results = results.filter(e => e.action.chain === chain)
      }
      if (filter?.from !== undefined) {
        const from = filter.from
        results = results.filter(e => e.timestamp >= from)
      }
      if (filter?.to !== undefined) {
        const to = filter.to
        results = results.filter(e => e.timestamp <= to)
      }
      if (filter?.status !== undefined) {
        const status = filter.status
        results = results.filter(e => e.outcome.status === status)
      }
      if (filter?.actionKind !== undefined) {
        const kind = filter.actionKind
        results = results.filter(e => e.action.kind === kind)
      }

      return Promise.resolve(results)
    },

    get(id: string): Promise<AuditEntry | null> {
      return Promise.resolve(entries.find(e => e.id === id) ?? null)
    },
  }
}
