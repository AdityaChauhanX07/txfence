import type { Redis } from 'ioredis'
import type { CapLockProvider, CapLockResult, CapConfig } from '@txfence/core'
import { ACQUIRE_SCRIPT, COMMIT_SCRIPT, RELEASE_SCRIPT } from './scripts.js'

function absoluteKey(capId: string): string {
  return `txfence:cap:${capId}:absolute`
}

function pendingKey(capId: string): string {
  return `txfence:cap:${capId}:pending`
}

function lockKey(capId: string, lockId: string): string {
  return `txfence:cap:${capId}:lock:${lockId}`
}

function windowKey(capId: string): string {
  return `txfence:cap:${capId}:window`
}

function generateLockId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function createRedisCapLockProvider(
  redis: Redis,
  configs: CapConfig[],
): CapLockProvider {
  return {
    async acquire(capId: string, amount: bigint, _token: string): Promise<CapLockResult> {
      const config = configs.find(c => c.capId === capId)
      if (config === undefined) throw new Error('unknown capId: ' + capId)

      const lockId = generateLockId()
      const absoluteCapMax = (config.absoluteCap?.maxAmount ?? 0n).toString()
      const rollingWindowMax = (config.rollingWindow?.maxAmount ?? 0n).toString()
      const rollingWindowMs = (config.rollingWindow?.windowMs ?? 0).toString()

      const result = await (redis as unknown as {
        eval(script: string, numkeys: number, ...args: string[]): Promise<unknown>
      }).eval(
        ACQUIRE_SCRIPT,
        4,
        absoluteKey(capId),
        pendingKey(capId),
        lockKey(capId, lockId),
        windowKey(capId),
        amount.toString(),
        absoluteCapMax,
        rollingWindowMax,
        rollingWindowMs,
        lockId,
        Date.now().toString(),
      )

      const resultStr = String(result)
      if (resultStr === 'granted') return { granted: true, lockId }
      if (resultStr === 'absolute_cap_exceeded') return { granted: false, reason: 'absolute_cap_exceeded' }
      if (resultStr === 'rolling_window_exceeded') return { granted: false, reason: 'rolling_window_exceeded' }
      throw new Error('unexpected result from Redis acquire script: ' + resultStr)
    },

    async release(capId: string, lockId: string, amount: bigint): Promise<void> {
      await (redis as unknown as {
        eval(script: string, numkeys: number, ...args: string[]): Promise<unknown>
      }).eval(
        RELEASE_SCRIPT,
        2,
        pendingKey(capId),
        lockKey(capId, lockId),
        amount.toString(),
      )
    },

    async commit(capId: string, lockId: string, amount: bigint): Promise<void> {
      await (redis as unknown as {
        eval(script: string, numkeys: number, ...args: string[]): Promise<unknown>
      }).eval(
        COMMIT_SCRIPT,
        4,
        absoluteKey(capId),
        pendingKey(capId),
        lockKey(capId, lockId),
        windowKey(capId),
        amount.toString(),
        lockId,
        Date.now().toString(),
      )
    },
  }
}
