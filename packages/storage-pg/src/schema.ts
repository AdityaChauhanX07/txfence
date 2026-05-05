import type { Pool } from 'pg'

export type PgStoreOptions = {
  tableName?: string
}

export const DEFAULT_TABLE = 'txfence_receipts'

export async function initSchema(pool: Pool, options?: PgStoreOptions): Promise<void> {
  // Table name comes from trusted config, not user input — template literal interpolation is safe here.
  const table = options?.tableName ?? DEFAULT_TABLE
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${table} (
      tx_hash             TEXT PRIMARY KEY,
      chain               TEXT NOT NULL,
      action              JSONB NOT NULL,
      policy_eval         JSONB NOT NULL,
      simulation          JSONB NOT NULL,
      confirmed_at_block  BIGINT NOT NULL,
      confirmed_at_ms     BIGINT NOT NULL,
      gas_used            TEXT NOT NULL,
      created_at          TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_${table}_chain
      ON ${table}(chain);

    CREATE INDEX IF NOT EXISTS idx_${table}_block
      ON ${table}(confirmed_at_block);
  `)
}
