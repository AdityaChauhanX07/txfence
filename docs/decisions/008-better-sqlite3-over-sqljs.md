# Use better-sqlite3 over sql.js for SQLite storage

**Status:** Accepted
**Date:** May 2026

## Context

Two TypeScript-friendly SQLite options exist for Node.js:

1. `better-sqlite3` — native Node.js addon, synchronous API, fast.
2. `sql.js` — pure JavaScript (compiled from C via Emscripten), works in browser, asynchronous API.

## Decision

Use `better-sqlite3`. The `@txfence/storage-sqlite` package targets Node.js server environments only — no browser requirement exists. `better-sqlite3`'s synchronous API is simpler to wrap in the async `ReceiptStore` interface (`Promise.resolve()` wrappers) and its native performance is significantly faster than `sql.js` for write-heavy audit and receipt workloads. The native addon requirement is acceptable for a server-side package.

## Consequences

**Positive:** simpler API, faster performance, clean `Promise.resolve()` wrapping produces an async interface with zero complexity overhead.

**Negative:** native addon means it must be rebuilt for different Node.js versions and architectures (handled by `prebuild-install`). Not usable in browser or edge environments. A team deploying to a restricted environment (e.g., Cloudflare Workers) would need the PostgreSQL backend instead.
