# @txfence/redis

Redis-backed `CapLockProvider` for [txfence](https://github.com/AdityaChauhanX07/txfence). Drop-in replacement for `createMemoryCapLockProvider` when multiple agents need to coordinate against the same spending caps across processes or machines.

## Why Redis?

`createMemoryCapLockProvider` from `@txfence/core` is in-process. If two agents each have their own process and both spend against the same cap, the in-memory provider cannot see across processes — race conditions are possible.

`@txfence/redis` uses atomic Lua scripts to make `acquire / commit / release` safe across any number of concurrent agents.

## Installation

```bash
npm install @txfence/redis @txfence/core ioredis
```

## Usage

```typescript
import Redis from 'ioredis'
import { createRedisCapLockProvider } from '@txfence/redis'
import { createAgent } from '@txfence/core'

const redis = new Redis(process.env.REDIS_URL!)

const capLockProvider = createRedisCapLockProvider(redis, {
  caps: [
    {
      capId: 'treasury-main',
      absoluteCap:   { maxAmount: 500_000n, token: 'USDC' },
      rollingWindow: { windowMs: 3_600_000, maxAmount: 25_000n, token: 'USDC' },
    },
  ],
  keyPrefix: 'txfence:caps',
})

const agent = createAgent(
  config, adapters, rpcUrls, executor,
  capLockProvider,
)
```

## Atomicity

Every operation that mutates a cap (`acquire`, `commit`, `release`) runs as a single Lua script inside Redis. The script holds the lock for the duration of the check-and-mutate, so two agents racing for the last 100 USDC of headroom cannot both succeed.

## Connection lifecycle

`@txfence/redis` does not create or close the `Redis` client. Inject your own:

```typescript
const redis = new Redis(process.env.REDIS_URL!)

// ... use the provider ...

await redis.quit()
```

Full project README: https://github.com/AdityaChauhanX07/txfence

## License

MIT
