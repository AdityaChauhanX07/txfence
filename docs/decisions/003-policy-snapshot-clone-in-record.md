# Deep clone policySnapshot inside AuditLog.record() not at the call site

**Status:** Accepted
**Date:** May 2026

## Context

The `AuditEntry` stores a `policySnapshot` — the policy that was in effect when the decision was made. If this is stored as a reference and the caller mutates their policy object after calling `record()`, the audit log silently becomes wrong. Two options:

1. Document that callers must not mutate the policy after calling `record()`.
2. Clone the policy inside `record()` so the audit log is always correct regardless of caller behavior.

## Decision

Clone inside `record()`. Documentation-only solutions fail in production. A caller working under pressure will not remember the contract. The clone is cheap (JSON serialize/deserialize with bigint revival) and the correctness guarantee is unconditional. The clone uses `JSON.parse(JSON.stringify(policy, bigintReplacer))` followed by bigint field revival — the same pattern used across all storage backends.

## Consequences

**Positive:** `policySnapshot` is always correct regardless of caller behavior. The audit log cannot be silently corrupted by post-record mutation.

**Negative:** slight overhead per `record()` call. Negligible in practice — audit records are written once per pipeline execution, not in hot loops.
