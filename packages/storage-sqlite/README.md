# @txfence/storage-sqlite

SQLite receipt storage backend for [txfence](https://github.com/AdityaChauhanX07/txfence). Ideal for local development and single-process staging environments — no database server required.

## Installation

```bash
pnpm add @txfence/storage-sqlite better-sqlite3
```

## Usage

```typescript
import Database from 'better-sqlite3'
import { initSchema, createSqliteReceiptStore } from '@txfence/storage-sqlite'
import { createAgent } from '@txfence/core'

const db = new Database('./receipts.db')

// Run once at startup — idempotent, safe to call on every deploy
initSchema(db)

const receiptStore = createSqliteReceiptStore(db)

// Pass to createAgent or runPipeline
const agent = createAgent(config, adapters, rpcUrls, executor, undefined, undefined, undefined, receiptStore)
```

### In-memory database (for tests)

```typescript
const db = new Database(':memory:')
initSchema(db)
const store = createSqliteReceiptStore(db)
```

### Custom table name

```typescript
initSchema(db, { tableName: 'my_receipts' })
const store = createSqliteReceiptStore(db, { tableName: 'my_receipts' })
```

## Table schema

```sql
CREATE TABLE IF NOT EXISTS txfence_receipts (
  tx_hash             TEXT PRIMARY KEY,
  chain               TEXT NOT NULL,
  action              TEXT NOT NULL,       -- JSON
  policy_eval         TEXT NOT NULL,       -- JSON
  simulation          TEXT NOT NULL,       -- JSON
  confirmed_at_block  INTEGER NOT NULL,
  confirmed_at_ms     INTEGER NOT NULL,
  gas_used            TEXT NOT NULL,       -- decimal string (bigint safe)
  created_at          TEXT DEFAULT (datetime('now'))
);
```

Indexes are created on `chain` and `confirmed_at_block` to support the filter parameters on `list()`.

`gas_used` and bigint fields within JSON columns are stored as decimal strings to avoid JavaScript `bigint` precision loss. They are revived to `bigint` on read.

## Synchronous API

`better-sqlite3` is synchronous — no connection pool, no async setup:

```typescript
const db = new Database('./receipts.db')
initSchema(db)
// db is ready to use immediately
```

The `ReceiptStore` interface methods return `Promise` to satisfy the interface contract, but the underlying SQLite calls are synchronous.

## SQLite vs PostgreSQL

| | `@txfence/storage-sqlite` | `@txfence/storage-pg` |
|---|---|---|
| Setup | Zero — file or `:memory:` | Requires a running PostgreSQL server |
| Concurrency | Single-process only | Multi-process safe |
| Use case | Local dev, single-process staging | Production multi-process deployments |
| Dependency | `better-sqlite3` (native) | `pg` |
