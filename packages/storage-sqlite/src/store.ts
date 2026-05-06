import type Database from 'better-sqlite3'
import type { ReceiptStore, ReceiptFilter, SuccessReceipt } from '@txfence/core'
import { DEFAULT_TABLE } from './schema.js'
import type { SqliteStoreOptions } from './schema.js'
import { serializeReceipt, deserializeReceipt } from './serialization.js'

export function createSqliteReceiptStore(
  db: Database.Database,
  options?: SqliteStoreOptions,
): ReceiptStore {
  // Table name comes from trusted config — template literal interpolation is safe here.
  const table = options?.tableName ?? DEFAULT_TABLE

  return {
    save(receipt: SuccessReceipt): Promise<void> {
      const row = serializeReceipt(receipt)
      db.prepare(
        `INSERT OR REPLACE INTO ${table}
           (tx_hash, chain, action, policy_eval, simulation,
            confirmed_at_block, confirmed_at_ms, gas_used)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.tx_hash,
        row.chain,
        row.action,
        row.policy_eval,
        row.simulation,
        row.confirmed_at_block,
        row.confirmed_at_ms,
        row.gas_used,
      )
      return Promise.resolve()
    },

    get(txHash: string): Promise<SuccessReceipt | null> {
      const row = db.prepare(
        `SELECT * FROM ${table} WHERE tx_hash = ? LIMIT 1`,
      ).get(txHash) as Record<string, unknown> | undefined
      if (row === undefined) return Promise.resolve(null)
      return Promise.resolve(deserializeReceipt(row))
    },

    list(filter?: ReceiptFilter): Promise<SuccessReceipt[]> {
      let sql = `SELECT * FROM ${table} WHERE 1=1`
      const params: unknown[] = []

      if (filter?.chain !== undefined) {
        sql += ' AND chain = ?'
        params.push(filter.chain)
      }

      if (filter?.from !== undefined) {
        sql += ' AND confirmed_at_block >= ?'
        params.push(filter.from)
      }

      if (filter?.to !== undefined) {
        sql += ' AND confirmed_at_block <= ?'
        params.push(filter.to)
      }

      sql += ' ORDER BY confirmed_at_block ASC'

      const rows = db.prepare(sql).all(params) as Record<string, unknown>[]
      return Promise.resolve(rows.map(deserializeReceipt))
    },
  }
}
