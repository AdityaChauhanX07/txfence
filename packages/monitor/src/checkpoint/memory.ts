import type { ChainId } from '../types.js'
import type { CheckpointStore } from '../types.js'

export function createMemoryCheckpointStore(): CheckpointStore {
  const lastBlocks = new Map<ChainId, number>()
  const pendingMaps = new Map<ChainId, Map<string, number>>()

  return {
    getLastBlock(chain: ChainId): Promise<number | null> {
      return Promise.resolve(lastBlocks.get(chain) ?? null)
    },

    setLastBlock(chain: ChainId, block: number): Promise<void> {
      lastBlocks.set(chain, block)
      return Promise.resolve()
    },

    getPending(chain: ChainId): Promise<Map<string, number>> {
      return Promise.resolve(pendingMaps.get(chain) ?? new Map())
    },

    setPending(chain: ChainId, pending: Map<string, number>): Promise<void> {
      pendingMaps.set(chain, pending)
      return Promise.resolve()
    },
  }
}
