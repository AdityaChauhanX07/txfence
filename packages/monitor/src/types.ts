import type { ChainId, ReceiptStore, NotificationProvider } from '@txfence/core'

export type { ChainId, ReceiptStore, NotificationProvider }

export type CheckpointStore = {
  getLastBlock: (chain: ChainId) => Promise<number | null>
  setLastBlock: (chain: ChainId, block: number) => Promise<void>
  getPending: (chain: ChainId) => Promise<Map<string, number>>
  setPending: (chain: ChainId, pending: Map<string, number>) => Promise<void>
}

export type UnrecordedTransactionEvent = {
  chain: ChainId
  txHash: string
  fromAddress: string
  toAddress: string | null
  value: string
  blockNumber: number
  detectedAt: number
  severity: 'warning' | 'critical'
}

export type ReorgEvent = {
  chain: ChainId
  txHash: string
  originalBlock: number
  detectedAt: number
}

export type MonitorChainStatus = {
  lastCheckedBlock: number
  lastCheckAt: number
}

export type MonitorStatus = {
  running: boolean
  chains: Partial<Record<ChainId, MonitorChainStatus>>
}

export type MonitorConfig = {
  chains: ChainId[]
  agentAddresses: Partial<Record<ChainId, string[]>>
  rpcUrls: Partial<Record<ChainId, string>>
  receiptStore: ReceiptStore
  checkpointStore: CheckpointStore
  pollIntervalMs?: number
  maxBlocksPerPoll?: number
  gracePeriodMs?: number
  reconcileIntervalMs?: number
  onUnrecordedTransaction: (event: UnrecordedTransactionEvent) => void
  onCriticalTransaction?: (event: UnrecordedTransactionEvent) => void
  onReorgDetected?: (event: ReorgEvent) => void
  notificationProvider?: NotificationProvider
}

export type Monitor = {
  start: () => Promise<void>
  stop: () => void
  status: () => MonitorStatus
}
