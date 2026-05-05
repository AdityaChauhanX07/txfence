import type { Pool } from 'pg'
import type { ReceiptStore, ReceiptFilter, SuccessReceipt } from '@txfence/core'
import { DEFAULT_TABLE } from './schema.js'
import type { PgStoreOptions } from './schema.js'
import { serializeReceipt, deserializeReceipt } from './serialization.js'

export function createPgReceiptStore(
  pool: Pool,
  options?: PgStoreOptions,
): ReceiptStore {
  // Table name comes from trusted config — template literal interpolation is safe here.
  const table = options?.tableName ?? DEFAULT_TABLE

  return {
    async save(receipt: SuccessReceipt): Promise<void> {
      const row = serializeReceipt(receipt)
      await pool.query(
        `INSERT INTO ${table}
           (tx_hash, chain, action, policy_eval, simulation, confirmed_at_block, confirmed_at_ms, gas_used)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (tx_hash) DO UPDATE SET
           chain = EXCLUDED.chain,
           action = EXCLUDED.action,
           policy_eval = EXCLUDED.policy_eval,
           simulation = EXCLUDED.simulation,
           confirmed_at_block = EXCLUDED.confirmed_at_block,
           confirmed_at_ms = EXCLUDED.confirmed_at_ms,
           gas_used = EXCLUDED.gas_used`,
        [
          row['tx_hash'],
          row['chain'],
          JSON.stringify(row['action']),
          JSON.stringify(row['policy_eval']),
          JSON.stringify(row['simulation']),
          row['confirmed_at_block'],
          row['confirmed_at_ms'],
          row['gas_used'],
        ],
      )
    },

    async get(txHash: string): Promise<SuccessReceipt | null> {
      const result = await pool.query<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE tx_hash = $1 LIMIT 1`,
        [txHash],
      )
      const first = result.rows[0]
      if (first === undefined) return null
      return deserializeReceipt(first)
    },

    async list(filter?: ReceiptFilter): Promise<SuccessReceipt[]> {
      let sql = `SELECT * FROM ${table} WHERE 1=1`
      const params: unknown[] = []

      if (filter?.chain !== undefined) {
        params.push(filter.chain)
        sql += ` AND chain = $${params.length}`
      }

      if (filter?.from !== undefined) {
        params.push(filter.from)
        sql += ` AND confirmed_at_block >= $${params.length}`
      }

      if (filter?.to !== undefined) {
        params.push(filter.to)
        sql += ` AND confirmed_at_block <= $${params.length}`
      }

      sql += ' ORDER BY confirmed_at_block ASC'

      const result = await pool.query<Record<string, unknown>>(sql, params)
      return result.rows.map(deserializeReceipt)
    },
  }
}
