import type { ChainId } from '../types/policy.js'
import type { SuccessReceipt } from '../types/receipt.js'

export type ReceiptFilter = {
  chain?: ChainId
  from?: number
  to?: number
}

export type ReceiptStore = {
  save: (receipt: SuccessReceipt) => Promise<void>
  get: (txHash: string) => Promise<SuccessReceipt | null>
  list: (filter?: ReceiptFilter) => Promise<SuccessReceipt[]>
}
