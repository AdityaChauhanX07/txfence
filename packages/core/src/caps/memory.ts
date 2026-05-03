import type { CapLockProvider, CapLockResult, CapConfig } from './provider.js'

type WindowBucket = {
  windowStart: number
  amount: bigint
}

type CapState = {
  config: CapConfig
  absoluteTotal: bigint
  pendingTotal: bigint
  windowBuckets: WindowBucket[]
  pendingLocks: Map<string, bigint>
}

export function createMemoryCapLockProvider(configs: CapConfig[]): CapLockProvider {
  const state = new Map<string, CapState>()

  for (const config of configs) {
    state.set(config.capId, {
      config,
      absoluteTotal: 0n,
      pendingTotal: 0n,
      windowBuckets: [],
      pendingLocks: new Map(),
    })
  }

  return {
    async acquire(capId: string, amount: bigint, _token: string): Promise<CapLockResult> {
      const capState = state.get(capId)
      if (capState === undefined) throw new Error('unknown capId: ' + capId)

      const { config } = capState
      const lockId = crypto.randomUUID()

      if (config.absoluteCap !== undefined) {
        if (capState.absoluteTotal + capState.pendingTotal + amount > config.absoluteCap.maxAmount) {
          return { granted: false, reason: 'absolute_cap_exceeded' }
        }
      }

      if (config.rollingWindow !== undefined) {
        const { windowMs, maxAmount } = config.rollingWindow
        const now = Date.now()
        capState.windowBuckets = capState.windowBuckets.filter(
          b => b.windowStart >= now - windowMs,
        )
        const windowTotal = capState.windowBuckets.reduce((sum, b) => sum + b.amount, 0n)
        if (windowTotal + capState.pendingTotal + amount > maxAmount) {
          return { granted: false, reason: 'rolling_window_exceeded' }
        }
      }

      capState.pendingTotal += amount
      capState.pendingLocks.set(lockId, amount)
      return { granted: true, lockId }
    },

    async release(capId: string, lockId: string, amount: bigint): Promise<void> {
      const capState = state.get(capId)
      if (capState === undefined) throw new Error('unknown capId: ' + capId)

      capState.pendingTotal = capState.pendingTotal >= amount ? capState.pendingTotal - amount : 0n
      capState.pendingLocks.delete(lockId)
    },

    async commit(capId: string, lockId: string, amount: bigint): Promise<void> {
      const capState = state.get(capId)
      if (capState === undefined) throw new Error('unknown capId: ' + capId)

      capState.pendingTotal = capState.pendingTotal >= amount ? capState.pendingTotal - amount : 0n
      capState.absoluteTotal += amount
      capState.windowBuckets.push({ windowStart: Date.now(), amount })
      capState.pendingLocks.delete(lockId)
    },
  }
}
