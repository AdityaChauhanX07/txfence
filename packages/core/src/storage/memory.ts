import type { ReceiptStore, ReceiptFilter } from './store.js'
import type { SuccessReceipt } from '../types/receipt.js'

export function createMemoryReceiptStore(): ReceiptStore {
  const receipts = new Map<string, SuccessReceipt>()

  return {
    save(receipt: SuccessReceipt): Promise<void> {
      receipts.set(receipt.txHash, receipt)
      return Promise.resolve()
    },

    get(txHash: string): Promise<SuccessReceipt | null> {
      return Promise.resolve(receipts.get(txHash) ?? null)
    },

    list(filter?: ReceiptFilter): Promise<SuccessReceipt[]> {
      let result = Array.from(receipts.values())
      if (filter !== undefined) {
        if (filter.chain !== undefined) {
          const chain = filter.chain
          result = result.filter(r => (r.action as { chain: string }).chain === chain)
        }
        if (filter.from !== undefined) {
          const from = filter.from
          result = result.filter(r => r.confirmedAtBlock >= from)
        }
        if (filter.to !== undefined) {
          const to = filter.to
          result = result.filter(r => r.confirmedAtBlock <= to)
        }
      }
      return Promise.resolve(result)
    },
  }
}
