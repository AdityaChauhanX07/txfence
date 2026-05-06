import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { AuditLog, AuditEntry, AuditFilter } from './types.js'
import { serializeEntry, deserializeEntry, clonePolicy } from './serialization.js'

export function createFileAuditLog(filePath: string): AuditLog {
  function readAll(): AuditEntry[] {
    if (!existsSync(filePath)) return []
    const content = readFileSync(filePath, 'utf-8')
    return content
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => deserializeEntry(line))
  }

  function applyFilter(entries: AuditEntry[], filter?: AuditFilter): AuditEntry[] {
    let results = entries
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
    return results
  }

  return {
    record(entry: AuditEntry): Promise<void> {
      const cloned: AuditEntry = {
        ...entry,
        policySnapshot: clonePolicy(entry.policySnapshot),
      }
      mkdirSync(dirname(filePath), { recursive: true })
      appendFileSync(filePath, serializeEntry(cloned) + '\n', 'utf-8')
      return Promise.resolve()
    },

    query(filter?: AuditFilter): Promise<AuditEntry[]> {
      return Promise.resolve(applyFilter(readAll(), filter))
    },

    get(id: string): Promise<AuditEntry | null> {
      const found = readAll().find(e => e.id === id)
      return Promise.resolve(found ?? null)
    },
  }
}
