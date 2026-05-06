import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ChainId } from '../types.js'
import type { CheckpointStore } from '../types.js'

type CheckpointData = {
  lastBlocks: Record<string, number>
  pending: Record<string, Record<string, number>>
}

function read(filePath: string): CheckpointData {
  if (!existsSync(filePath)) return { lastBlocks: {}, pending: {} }
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as CheckpointData
  } catch {
    return { lastBlocks: {}, pending: {} }
  }
}

// Write-then-rename ensures the checkpoint file is never partially written.
// On POSIX: rename is atomic — readers always see either the old or new file.
// On Windows: rename is not atomic but the .tmp file is replaced only after
// a complete write, so the checkpoint file is never left in a partial state.
function write(filePath: string, data: CheckpointData): void {
  mkdirSync(dirname(filePath), { recursive: true })
  const tmpPath = filePath + '.tmp'
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  renameSync(tmpPath, filePath)
}

export function createFileCheckpointStore(filePath: string): CheckpointStore {
  return {
    getLastBlock(chain: ChainId): Promise<number | null> {
      const data = read(filePath)
      return Promise.resolve(data.lastBlocks[chain] ?? null)
    },

    setLastBlock(chain: ChainId, block: number): Promise<void> {
      const data = read(filePath)
      data.lastBlocks[chain] = block
      write(filePath, data)
      return Promise.resolve()
    },

    getPending(chain: ChainId): Promise<Map<string, number>> {
      const data = read(filePath)
      const raw = data.pending[chain] ?? {}
      return Promise.resolve(
        new Map(Object.entries(raw).map(([k, v]) => [k, Number(v)]))
      )
    },

    setPending(chain: ChainId, pending: Map<string, number>): Promise<void> {
      const data = read(filePath)
      data.pending[chain] = Object.fromEntries(pending.entries())
      write(filePath, data)
      return Promise.resolve()
    },
  }
}
