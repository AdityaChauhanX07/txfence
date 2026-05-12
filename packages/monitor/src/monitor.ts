import { createPublicClient, http } from 'viem'
import { getViemChain } from '@txfence/evm'
import type { ChainId } from '@txfence/core'
import type {
  MonitorConfig,
  Monitor,
  MonitorStatus,
  MonitorChainStatus,
  UnrecordedTransactionEvent,
  ReorgEvent,
} from './types.js'
import { scanBlockRange } from './scanner.js'
import { reconcileReceipts } from './reconciler.js'

export function createMonitor(config: MonitorConfig): Monitor {
  const pollIntervalMs = config.pollIntervalMs ?? 12000
  const maxBlocksPerPoll = config.maxBlocksPerPoll ?? 5
  const gracePeriodMs = config.gracePeriodMs ?? 30000
  const reconcileIntervalMs = config.reconcileIntervalMs ?? 300000

  let running = false
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let reconcileTimer: ReturnType<typeof setTimeout> | null = null
  const chainStatus: Partial<Record<ChainId, MonitorChainStatus>> = {}

  function status(): MonitorStatus {
    return { running, chains: { ...chainStatus } }
  }

  function stop(): void {
    running = false
    if (pollTimer) clearTimeout(pollTimer)
    if (reconcileTimer) clearTimeout(reconcileTimer)
  }

  async function pollChain(chain: ChainId): Promise<void> {
    const rpcUrl = config.rpcUrls[chain]
    const addresses = config.agentAddresses[chain] ?? []
    if (!rpcUrl || addresses.length === 0) return

    const viemChain = getViemChain(chain)
    const client = createPublicClient({ chain: viemChain, transport: http(rpcUrl) })
    const currentBlock = Number(await client.getBlockNumber())

    const lastBlock = await config.checkpointStore.getLastBlock(chain) ?? currentBlock - 1
    const fromBlock = lastBlock + 1
    const toBlock = Math.min(currentBlock, fromBlock + maxBlocksPerPoll - 1)

    if (fromBlock > toBlock) return

    const found = await scanBlockRange(chain, fromBlock, toBlock, addresses, rpcUrl)
    const pending = await config.checkpointStore.getPending(chain)

    for (const tx of found) {
      const stored = await config.receiptStore.get(tx.txHash)
      if (stored !== null) {
        pending.delete(tx.txHash)
        continue
      }

      if (!pending.has(tx.txHash)) {
        pending.set(tx.txHash, Date.now())
        const event: UnrecordedTransactionEvent = {
          chain,
          txHash: tx.txHash,
          fromAddress: tx.fromAddress,
          toAddress: tx.toAddress,
          value: tx.value,
          blockNumber: tx.blockNumber,
          detectedAt: Date.now(),
          severity: 'warning',
        }
        config.onUnrecordedTransaction(event)
        void config.notificationProvider?.notify({ kind: 'monitor_unrecorded', ...event })
      } else {
        const firstSeen = pending.get(tx.txHash)!
        if (Date.now() - firstSeen > gracePeriodMs) {
          const event: UnrecordedTransactionEvent = {
            chain,
            txHash: tx.txHash,
            fromAddress: tx.fromAddress,
            toAddress: tx.toAddress,
            value: tx.value,
            blockNumber: tx.blockNumber,
            detectedAt: Date.now(),
            severity: 'critical',
          }
          config.onUnrecordedTransaction(event)
          config.onCriticalTransaction?.(event)
          void config.notificationProvider?.notify({ kind: 'monitor_unrecorded', ...event })
          pending.delete(tx.txHash)
        }
      }
    }

    await config.checkpointStore.setPending(chain, pending)
    await config.checkpointStore.setLastBlock(chain, toBlock)
    chainStatus[chain] = { lastCheckedBlock: toBlock, lastCheckAt: Date.now() }
  }

  async function pollLoop(): Promise<void> {
    if (!running) return
    try {
      await Promise.all(config.chains.map(chain => pollChain(chain)))
    } catch (err) {
      console.error('[txfence/monitor] poll error:', err)
    }
    if (running) {
      pollTimer = setTimeout(() => { void pollLoop() }, pollIntervalMs)
    }
  }

  function makeReorgHandler(): ((event: ReorgEvent) => void) | undefined {
    if (config.onReorgDetected === undefined && config.notificationProvider === undefined) return undefined
    return (event: ReorgEvent): void => {
      config.onReorgDetected?.(event)
      void config.notificationProvider?.notify({
        kind: 'monitor_reorg',
        chain: event.chain,
        txHash: event.txHash,
        originalBlock: event.originalBlock,
        detectedAt: event.detectedAt,
      })
    }
  }

  async function reconcileLoop(): Promise<void> {
    if (!running) return
    try {
      await Promise.all(config.chains.map(chain => {
        const rpcUrl = config.rpcUrls[chain]
        if (!rpcUrl) return Promise.resolve()
        return reconcileReceipts(chain, rpcUrl, config.receiptStore, 100, makeReorgHandler())
      }))
    } catch (err) {
      console.error('[txfence/monitor] reconcile error:', err)
    }
    if (running) {
      reconcileTimer = setTimeout(() => { void reconcileLoop() }, reconcileIntervalMs)
    }
  }

  async function start(): Promise<void> {
    running = true
    await pollLoop()
    void reconcileLoop()
  }

  return { start, stop, status }
}
