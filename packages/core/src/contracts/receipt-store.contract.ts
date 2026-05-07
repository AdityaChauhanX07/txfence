import { describe, it, expect } from 'vitest'
import type { ReceiptStore } from '../storage/store.js'
import type { SuccessReceipt } from '../types/receipt.js'
import type { TransferAction } from '../types/action.js'

function makeReceipt(overrides: Partial<SuccessReceipt> = {}): SuccessReceipt {
  const action: TransferAction = {
    kind: 'transfer',
    chain: 'ethereum',
    token: { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  }
  return {
    status: 'success',
    action,
    policyEvaluation: { passed: true, checksRun: ['checkChain'] },
    simulation: {
      success: true,
      wouldRevert: false,
      chain: 'ethereum',
      simulatedAtBlock: 1000,
      gasEstimate: 21000n,
      gasBufferApplied: 1.2,
      coverageLevel: 'basic',
      caveats: ['state_may_diverge'],
      provider: 'eth_call',
    },
    txHash: '0xabc123',
    confirmedAtBlock: 1000,
    confirmedAtMs: Date.now(),
    gasUsed: 21000n,
    ...overrides,
  }
}

export function receiptStoreContract(name: string, createStore: () => ReceiptStore): void {
  describe(name, () => {
    it('saves and retrieves a receipt by txHash', async () => {
      const store = createStore()
      await store.save(makeReceipt())
      const found = await store.get('0xabc123')
      expect(found).not.toBeNull()
      expect(found?.txHash).toBe('0xabc123')
    })

    it('returns null for unknown txHash', async () => {
      const store = createStore()
      expect(await store.get('0xunknown')).toBeNull()
    })

    it('returns empty array on list() when store is empty', async () => {
      const store = createStore()
      expect(await store.list()).toHaveLength(0)
    })

    it('lists all receipts with no filter', async () => {
      const store = createStore()
      await store.save(makeReceipt({ txHash: '0xaaa', confirmedAtBlock: 100 }))
      await store.save(makeReceipt({ txHash: '0xbbb', confirmedAtBlock: 200 }))
      expect(await store.list()).toHaveLength(2)
    })

    it('filters by chain', async () => {
      const store = createStore()
      await store.save(makeReceipt({ txHash: '0xevm' }))
      const solanaAction: TransferAction = {
        kind: 'transfer',
        chain: 'solana',
        token: { token: 'SOL', amount: 1000000000n, decimals: 9 },
        to: 'DummyAddress',
      }
      await store.save(makeReceipt({ txHash: '0xsol', action: solanaAction }))
      const evmOnly = await store.list({ chain: 'ethereum' })
      expect(evmOnly).toHaveLength(1)
      expect(evmOnly[0]!.txHash).toBe('0xevm')
    })

    it('filters by from block', async () => {
      const store = createStore()
      await store.save(makeReceipt({ txHash: '0xold', confirmedAtBlock: 100 }))
      await store.save(makeReceipt({ txHash: '0xnew', confirmedAtBlock: 200 }))
      const recent = await store.list({ from: 150 })
      expect(recent).toHaveLength(1)
      expect(recent[0]!.txHash).toBe('0xnew')
    })

    it('filters by to block', async () => {
      const store = createStore()
      await store.save(makeReceipt({ txHash: '0xold', confirmedAtBlock: 100 }))
      await store.save(makeReceipt({ txHash: '0xnew', confirmedAtBlock: 200 }))
      const early = await store.list({ to: 150 })
      expect(early).toHaveLength(1)
      expect(early[0]!.txHash).toBe('0xold')
    })
  })
}
