import type Database from 'better-sqlite3'

export type SqliteStoreOptions = {
  tableName?: string
}

export const DEFAULT_TABLE = 'txfence_receipts'

export function initSchema(db: Database.Database, options?: SqliteStoreOptions): void {
  // Table name comes from trusted config, not user input — template literal interpolation is safe here.
  const table = options?.tableName ?? DEFAULT_TABLE
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${table} (
      tx_hash             TEXT PRIMARY KEY,
      chain               TEXT NOT NULL,
      action              TEXT NOT NULL,
      policy_eval         TEXT NOT NULL,
      simulation          TEXT NOT NULL,
      confirmed_at_block  INTEGER NOT NULL,
      confirmed_at_ms     INTEGER NOT NULL,
      gas_used            TEXT NOT NULL,
      created_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_${table}_chain
      ON ${table}(chain);

    CREATE INDEX IF NOT EXISTS idx_${table}_block
      ON ${table}(confirmed_at_block);
  `)
}
