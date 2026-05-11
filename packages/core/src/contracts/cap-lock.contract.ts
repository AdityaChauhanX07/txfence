import { describe, it, expect } from 'vitest'
import type { CapLockProvider, CapConfig } from '../caps/provider.js'

export function capLockProviderContract(
  name: string,
  createProvider: (configs: CapConfig[]) => CapLockProvider,
): void {
  describe(name, () => {
    it('grants when spend is within absolute cap', async () => {
      const provider = createProvider([
        { capId: 'cap1', absoluteCap: { maxAmount: 1000n, token: 'USDC' } },
      ])
      const result = await provider.acquire('cap1', 100n, 'USDC')
      expect(result.granted).toBe(true)
    })

    it('rejects with absolute_cap_exceeded when spend exceeds cap', async () => {
      const provider = createProvider([
        { capId: 'cap1', absoluteCap: { maxAmount: 100n, token: 'USDC' } },
      ])
      const result = await provider.acquire('cap1', 101n, 'USDC')
      expect(result.granted).toBe(false)
      if (result.granted) throw new Error('expected rejection')
      expect(result.reason).toBe('absolute_cap_exceeded')
    })

    it('accounts for pending spend in the cap check', async () => {
      const provider = createProvider([
        { capId: 'cap1', absoluteCap: { maxAmount: 100n, token: 'USDC' } },
      ])
      const r1 = await provider.acquire('cap1', 60n, 'USDC')
      expect(r1.granted).toBe(true)
      const r2 = await provider.acquire('cap1', 50n, 'USDC')
      expect(r2.granted).toBe(false)
    })

    it('releases pending amount so a subsequent acquire can succeed', async () => {
      const provider = createProvider([
        { capId: 'cap1', absoluteCap: { maxAmount: 100n, token: 'USDC' } },
      ])
      const r1 = await provider.acquire('cap1', 60n, 'USDC')
      expect(r1.granted).toBe(true)
      if (!r1.granted) throw new Error('expected granted')
      await provider.release('cap1', r1.lockId, 60n)
      const r2 = await provider.acquire('cap1', 60n, 'USDC')
      expect(r2.granted).toBe(true)
    })

    it('accumulates committed spend so future acquires are checked against it', async () => {
      const provider = createProvider([
        { capId: 'cap1', absoluteCap: { maxAmount: 100n, token: 'USDC' } },
      ])
      const r1 = await provider.acquire('cap1', 60n, 'USDC')
      expect(r1.granted).toBe(true)
      if (!r1.granted) throw new Error('expected granted')
      await provider.commit('cap1', r1.lockId, 60n)
      const r2 = await provider.acquire('cap1', 50n, 'USDC')
      expect(r2.granted).toBe(false)
      if (r2.granted) throw new Error('expected rejection')
      expect(r2.reason).toBe('absolute_cap_exceeded')
    })

    it('inspect() returns current state after acquire', async () => {
      const provider = await Promise.resolve(createProvider([{
        capId: 'contract-cap-inspect',
        absoluteCap: { maxAmount: 1000n, token: 'USDC' },
      }]))
      const before = await provider.inspect('contract-cap-inspect')
      expect(before.absoluteCap?.remaining).toBe(1000n)
      expect(before.absoluteCap?.totalCommitted).toBe(0n)
      expect(before.activeLocks).toBe(0)

      const result = await provider.acquire('contract-cap-inspect', 400n, 'USDC')
      expect(result.granted).toBe(true)

      const after = await provider.inspect('contract-cap-inspect')
      expect(after.absoluteCap?.totalPending).toBe(400n)
      expect(after.absoluteCap?.remaining).toBe(600n)
      expect(after.activeLocks).toBe(1)
    })

    it('inspect() throws for unknown capId', async () => {
      const provider = await Promise.resolve(createProvider([]))
      await expect(provider.inspect('nonexistent')).rejects.toThrow()
    })
  })
}