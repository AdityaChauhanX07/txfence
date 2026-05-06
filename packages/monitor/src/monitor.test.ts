import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createMemoryCheckpointStore } from './checkpoint/memory.js'
import { createFileCheckpointStore } from './checkpoint/file.js'
import { createMonitor } from './monitor.js'
import type { ReceiptStore } from '@txfence/core'

function makeMockReceiptStore(knownHashes: string[] = []): ReceiptStore {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockImplementation((hash: string) =>
      Promise.resolve(knownHashes.includes(hash) ? ({ txHash: hash } as Parameters<ReceiptStore['save']>[0]) : null)
    ),
    list: vi.fn().mockResolvedValue([]),
  }
}

describe('createMemoryCheckpointStore', () => {
  it('returns null for unknown chain', async () => {
    const store = createMemoryCheckpointStore()
    expect(await store.getLastBlock('ethereum')).toBeNull()
  })

  it('saves and retrieves last block', async () => {
    const store = createMemoryCheckpointStore()
    await store.setLastBlock('ethereum', 25000000)
    expect(await store.getLastBlock('ethereum')).toBe(25000000)
  })

  it('saves and retrieves pending map', async () => {
    const store = createMemoryCheckpointStore()
    const pending = new Map([['0xabc', 1000000]])
    await store.setPending('ethereum', pending)
    const retrieved = await store.getPending('ethereum')
    expect(retrieved.get('0xabc')).toBe(1000000)
  })

  it('returns empty map for unknown chain pending', async () => {
    const store = createMemoryCheckpointStore()
    const pending = await store.getPending('ethereum')
    expect(pending.size).toBe(0)
  })

  it('tracks different chains independently', async () => {
    const store = createMemoryCheckpointStore()
    await store.setLastBlock('ethereum', 100)
    await store.setLastBlock('base', 200)
    expect(await store.getLastBlock('ethereum')).toBe(100)
    expect(await store.getLastBlock('base')).toBe(200)
  })
})

describe('createFileCheckpointStore', () => {
  const TMP_DIR = 'src/__test_tmp_monitor__'
  const TMP_FILE = join(TMP_DIR, 'checkpoint.json')

  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true })
  })

  it('returns null when file does not exist', async () => {
    const store = createFileCheckpointStore(TMP_FILE + '.noexist')
    expect(await store.getLastBlock('ethereum')).toBeNull()
  })

  it('saves and retrieves last block persistently', async () => {
    const store = createFileCheckpointStore(TMP_FILE)
    await store.setLastBlock('ethereum', 25000000)
    const store2 = createFileCheckpointStore(TMP_FILE)
    expect(await store2.getLastBlock('ethereum')).toBe(25000000)
  })

  it('saves and retrieves pending map persistently', async () => {
    const store = createFileCheckpointStore(TMP_FILE)
    await store.setPending('ethereum', new Map([['0xabc', 1000000]]))
    const store2 = createFileCheckpointStore(TMP_FILE)
    const retrieved = await store2.getPending('ethereum')
    expect(retrieved.get('0xabc')).toBe(1000000)
  })

  it('tracks multiple chains in same file', async () => {
    const store = createFileCheckpointStore(TMP_FILE)
    await store.setLastBlock('ethereum', 100)
    await store.setLastBlock('base', 200)
    expect(await store.getLastBlock('ethereum')).toBe(100)
    expect(await store.getLastBlock('base')).toBe(200)
  })

  it('does not leave a .tmp file after successful write', async () => {
    const store = createFileCheckpointStore(TMP_FILE)
    await store.setLastBlock('ethereum', 25000000)
    const tmpPath = TMP_FILE + '.tmp'
    expect(existsSync(tmpPath)).toBe(false)
    expect(existsSync(TMP_FILE)).toBe(true)
  })

  it('recovers correctly when reading after a successful write', async () => {
    const store = createFileCheckpointStore(TMP_FILE)
    await store.setLastBlock('ethereum', 25000000)
    await store.setLastBlock('ethereum', 25000001)
    const store2 = createFileCheckpointStore(TMP_FILE)
    expect(await store2.getLastBlock('ethereum')).toBe(25000001)
  })
})

describe('monitor status and lifecycle', () => {
  it('reports not running before start', () => {
    const monitor = createMonitor({
      chains: ['ethereum'],
      agentAddresses: { ethereum: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'] },
      rpcUrls: { ethereum: 'http://127.0.0.1:8545' },
      receiptStore: makeMockReceiptStore(),
      checkpointStore: createMemoryCheckpointStore(),
      onUnrecordedTransaction: vi.fn(),
    })
    const s = monitor.status()
    expect(s.running).toBe(false)
    expect(s.chains).toEqual({})
  })

  it('stop() is safe to call before start()', () => {
    const monitor = createMonitor({
      chains: ['ethereum'],
      agentAddresses: {},
      rpcUrls: {},
      receiptStore: makeMockReceiptStore(),
      checkpointStore: createMemoryCheckpointStore(),
      onUnrecordedTransaction: vi.fn(),
    })
    expect(() => monitor.stop()).not.toThrow()
  })
})
