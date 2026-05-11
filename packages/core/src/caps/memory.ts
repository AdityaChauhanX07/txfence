import type { CapLockProvider, CapLockResult, CapConfig, CapWarningEvent, CapInspection, AbsoluteCapInspection, RollingWindowInspection } from './provider.js'

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

export type MemoryCapLockProviderOptions = {
  onCapWarning?: (event: CapWarningEvent) => void
}

function checkWarning(
  capId: string,
  config: CapConfig,
  currentAmount: bigint,
  capAmount: bigint,
  token: string,
  type: 'absolute' | 'rolling_window',
  onWarning?: (event: CapWarningEvent) => void,
): void {
  if (onWarning === undefined) return
  if (config.warningThresholdPct === undefined) return
  const pctUsed = Number(currentAmount * 100n / capAmount)
  if (pctUsed >= config.warningThresholdPct) {
    onWarning({
      capId,
      type,
      currentAmount,
      capAmount,
      pctUsed: Math.round(pctUsed * 10) / 10,
      token,
    })
  }
}

export function createMemoryCapLockProvider(
  configs: CapConfig[],
  options?: MemoryCapLockProviderOptions,
): CapLockProvider {
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
    async acquire(capId: string, amount: bigint, token: string): Promise<CapLockResult> {
      const capState = state.get(capId)
      if (capState === undefined) throw new Error('unknown capId: ' + capId)

      const { config } = capState
      const lockId = crypto.randomUUID()

      if (config.absoluteCap !== undefined) {
        if (capState.absoluteTotal + capState.pendingTotal + amount > config.absoluteCap.maxAmount) {
          return { granted: false, reason: 'absolute_cap_exceeded' }
        }
        const projected = capState.absoluteTotal + capState.pendingTotal + amount
        checkWarning(capId, config, projected, config.absoluteCap.maxAmount, token, 'absolute', options?.onCapWarning)
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
        const projectedWindow = windowTotal + capState.pendingTotal + amount
        checkWarning(capId, config, projectedWindow, maxAmount, token, 'rolling_window', options?.onCapWarning)
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

      if (capState.config.absoluteCap !== undefined) {
        checkWarning(capId, capState.config, capState.absoluteTotal, capState.config.absoluteCap.maxAmount, capState.config.absoluteCap.token, 'absolute', options?.onCapWarning)
      }
    },

    async inspect(capId: string): Promise<CapInspection> {
      const capState = state.get(capId)
      if (capState === undefined) throw new Error('unknown capId: ' + capId)

      const now = Date.now()
      const config = capState.config

      let absoluteCapInspection: AbsoluteCapInspection | undefined = undefined
      if (config.absoluteCap !== undefined) {
        const totalCommitted = capState.absoluteTotal
        const totalPending = capState.pendingTotal
        const maxAmount = config.absoluteCap.maxAmount
        const used = totalCommitted + totalPending
        absoluteCapInspection = {
          maxAmount,
          token: config.absoluteCap.token,
          totalCommitted,
          totalPending,
          remaining: used >= maxAmount ? 0n : maxAmount - used,
          pctUsed: Math.round(Number(used * 1000n / maxAmount)) / 10,
        }
      }

      let rollingWindowInspection: RollingWindowInspection | undefined = undefined
      if (config.rollingWindow !== undefined) {
        const windowMs = config.rollingWindow.windowMs
        const maxAmount = config.rollingWindow.maxAmount

        const activeBuckets = capState.windowBuckets.filter(
          b => b.windowStart >= now - windowMs
        )

        const totalInWindow = activeBuckets.reduce((sum, b) => sum + b.amount, 0n)
        const totalPending = capState.pendingTotal
        const used = totalInWindow + totalPending

        const windowStart = activeBuckets.length > 0
          ? Math.min(...activeBuckets.map(b => b.windowStart))
          : now

        const resetsAt = activeBuckets.length > 0
          ? Math.min(...activeBuckets.map(b => b.windowStart)) + windowMs
          : now

        rollingWindowInspection = {
          maxAmount,
          token: config.rollingWindow.token,
          windowMs,
          windowStart,
          totalInWindow,
          totalPending,
          remaining: used >= maxAmount ? 0n : maxAmount - used,
          pctUsed: Math.round(Number(used * 1000n / maxAmount)) / 10,
          resetsAt,
        }
      }

      return Promise.resolve({
        capId,
        ...(absoluteCapInspection !== undefined ? { absoluteCap: absoluteCapInspection } : {}),
        ...(rollingWindowInspection !== undefined ? { rollingWindow: rollingWindowInspection } : {}),
        activeLocks: capState.pendingLocks.size,
      })
    },

    ...(options?.onCapWarning !== undefined ? { onCapWarning: options.onCapWarning } : {}),
  }
}
