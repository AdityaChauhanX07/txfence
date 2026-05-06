# Use ioredis over the official redis client for Redis cap locking

**Status:** Accepted
**Date:** May 2026

## Context

Two major Redis clients exist for Node.js TypeScript projects: ioredis (community, widely adopted) and redis (official Node Redis client maintained by Redis Ltd). The Redis cap lock provider requires Lua script execution via `redis.eval()`, atomic operations, and strong TypeScript types. Both clients support these features.

## Decision

Use ioredis. At the time of writing, ioredis has significantly better TypeScript support for Lua script execution, cleaner handling of the `eval()` signature with typed key and argument arrays, and a larger body of community examples for the atomic patterns needed by the cap lock implementation. The official redis client has improved but ioredis remains the more mature choice for complex Redis usage.

## Consequences

**Positive:** better TypeScript types for `redis.eval`, more community resources for atomic Lua patterns.

**Negative:** ioredis is community-maintained, not backed by Redis Ltd. If ioredis is ever abandoned, migration to the official client is straightforward since the interface is similar.
