# @txfence/storage-pg

PostgreSQL receipt storage backend for [txfence](https://github.com/AdityaChauhanX/txfence).

## Installation

```bash
pnpm add @txfence/storage-pg pg
```

## Usage

```typescript
import { Pool } from 'pg'
import { initSchema, createPgReceiptStore } from '@txfence/storage-pg'
import { createAgent } from '@txfence/core'

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] })

// Run once at startup — idempotent, safe to call on every deploy
await initSchema(pool)

const receiptStore = createPgReceiptStore(pool)

// Pass to createAgent or runPipeline
const agent = createAgent(config, adapters, rpcUrls, executor, undefined, undefined, undefined, receiptStore)
```

### Custom table name

```typescript
await initSchema(pool, { tableName: 'my_receipts' })
const store = createPgReceiptStore(pool, { tableName: 'my_receipts' })
```

## Table schema

```sql
CREATE TABLE IF NOT EXISTS txfence_receipts (
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
```

Indexes are created on `chain` and `confirmed_at_block` to support the filter parameters on `list()`.

`gas_used` is stored as `TEXT` because PostgreSQL `BIGINT` cannot represent all 256-bit values and JavaScript `bigint` is serialized as a decimal string.

## Connection lifecycle

`@txfence/storage-pg` does not create or destroy `pg.Pool` connections. Inject your own pool and manage its lifecycle in your application:

```typescript
const pool = new Pool({ connectionString: process.env['DATABASE_URL'] })

// ... use the store ...

await pool.end() // shut down gracefully
```

## Environment variable pattern

```typescript
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  // or individually:
  host: process.env['PGHOST'],
  port: Number(process.env['PGPORT'] ?? 5432),
  database: process.env['PGDATABASE'],
  user: process.env['PGUSER'],
  password: process.env['PGPASSWORD'],
})
```
