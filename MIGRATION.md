---

# Migration guide

This document covers breaking changes between txfence versions and how to migrate your code and data.

txfence uses [Changesets](https://github.com/changesets/changesets) for version management. Breaking changes are always released as major version bumps. Minor versions add new features without breaking existing APIs. Patch versions fix bugs.

---

## Schema evolution strategy

txfence stores data in three places: receipt stores, audit logs, and monitor checkpoints. Each has a different migration story.

### Receipt stores

**File-based (`createFileReceiptStore`):** The NDJSON format is append-only. Each line is a self-contained JSON object. Adding new fields to `SuccessReceipt` is backward-compatible — old lines simply won't have the new field. Removing or renaming fields is a breaking change that requires a migration script.

**PostgreSQL (`createPgReceiptStore`):** The `txfence_receipts` table schema is created by `initSchema()`. Additive changes (new nullable columns) can be applied with `ALTER TABLE`. Non-additive changes require a migration. txfence does not ship a migration runner — use your existing database migration tool (Flyway, Liquibase, node-pg-migrate, etc.).

**SQLite (`createSqliteReceiptStore`):** Same strategy as PostgreSQL. Use a migration tool or write migration scripts manually.

### Audit logs

**File-based (`createFileAuditLog`):** Same as file receipt stores — append-only NDJSON. Old entries remain readable. New entries have new fields. No migration needed for additive changes.

### Monitor checkpoints

**File-based (`createFileCheckpointStore`):** Simple JSON with `lastBlocks` and `pending` keys. If the format changes, delete the checkpoint file and let the monitor restart from the current block. You may miss transactions in the gap — check the audit log for that period manually.

---

## Version history

### v0.x — pre-release

txfence is currently pre-release (v0.x). The public API is stabilizing but breaking changes may occur between minor versions. Pin your version in `package.json` and review the CHANGELOG before upgrading.

When txfence reaches v1.0.0, the API will be stable and breaking changes will only occur in major versions.

---

## Migrating between versions

### SimulationResult type changes (v0.10.0)

**What changed:** `SimulationResult` gained three new required fields: `wouldRevert: boolean`, `provider: 'eth_call' | 'tenderly'`, and `coverageLevel` was renamed from `'partial'` to `'basic'` for eth_call simulation.

**If you construct `SimulationResult` objects manually** (e.g. in custom adapters or tests):
- Add `wouldRevert: false` to all simulation results
- Add `provider: 'eth_call'` to all simulation results
- Change `coverageLevel: 'partial'` to `coverageLevel: 'basic'` for eth_call results

**If you only consume `SimulationResult`** (reading fields): no change required.

---

### ExecutionResult union changes (v0.22.0)

**What changed:** `ExecutionResult` gained a new variant: `{ status: 'simulation_stale'; action: Action; simulation: SimulationResult; stalenessMs: number }`.

**If you have exhaustive switch statements on `result.status`:** add a `simulation_stale` case. TypeScript will warn you at compile time if you have exhaustive switches — follow the compiler errors.

---

### Policy type additions (v0.22.0)

**What changed:** `Policy` gained an optional field: `simulationStalenessMs?: number`.

**Migration:** No action required. The field is optional and defaults to disabled.

---

### Agent API changes (v0.25.0)

**What changed:** The `Agent` type gained three new methods: `shutdown()`, `isShuttingDown()`, and `health()`. The `submit()` signature changed from `(action: BoundAction)` to `(input: { action: Action; policy: Policy })`.

**If you call `agent.submit()`:** update call sites to pass an object: `agent.submit({ action, policy })`.

**If you implement the `Agent` interface:** add the three new methods.

---

## Data migration scripts

### Receipt store: add provider and wouldRevert to historical records

If you have an existing file receipt store from before v0.10.0, historical records will be missing `provider` and `wouldRevert` on the simulation field. This script adds them:

```typescript
import { readFileSync, writeFileSync } from 'fs'

const filePath = './receipts.jsonl'
const lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)

const migrated = lines.map(line => {
  const receipt = JSON.parse(line)
  if (receipt.simulation && receipt.simulation.provider === undefined) {
    receipt.simulation.provider = 'eth_call'
    receipt.simulation.wouldRevert = false
  }
  return JSON.stringify(receipt)
})

// Write to a new file — never overwrite the original directly
writeFileSync('./receipts.migrated.jsonl', migrated.join('\n') + '\n', 'utf-8')
console.log(`Migrated ${migrated.length} receipts`)
```

Always verify the migrated file before replacing the original.

---

## Known limitations

**No automatic schema migrations.** txfence does not ship a migration runner. This is intentional — txfence does not know what migration tool your team uses, and auto-migrations on startup are dangerous in production. Explicit migrations are always safer.

**No data versioning.** Receipt and audit log entries do not include a schema version field. If you need to detect the version of an entry programmatically, add a `_version` field to your custom storage implementation.

**File stores are not suitable for high-volume production use.** They have no indexing, no concurrent write safety, and no migration tooling. Use them for development and low-volume staging. Use PostgreSQL for production.
