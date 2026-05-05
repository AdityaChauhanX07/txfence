import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ReceiptStore, ReceiptFilter } from './store.js'
import type { SuccessReceipt } from '../types/receipt.js'

function replacer(_: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v
}

function reviveBigIntFields(raw: Record<string, unknown>): SuccessReceipt {
  if (typeof raw['gasUsed'] === 'string') {
    raw['gasUsed'] = BigInt(raw['gasUsed'])
  }

  const sim = raw['simulation'] as Record<string, unknown> | undefined
  if (sim !== undefined) {
    if (typeof sim['gasEstimate'] === 'string') {
      sim['gasEstimate'] = BigInt(sim['gasEstimate'])
    }
    const expectedOutput = sim['expectedOutput'] as Record<string, unknown> | undefined
    if (expectedOutput !== undefined && typeof expectedOutput['amount'] === 'string') {
      expectedOutput['amount'] = BigInt(expectedOutput['amount'])
    }
  }

  const action = raw['action'] as Record<string, unknown> | undefined
  if (action !== undefined) {
    const kind = action['kind']
    if (kind === 'transfer') {
      const token = action['token'] as Record<string, unknown> | undefined
      if (token !== undefined && typeof token['amount'] === 'string') {
        token['amount'] = BigInt(token['amount'])
      }
    } else if (kind === 'swap') {
      const from = action['from'] as Record<string, unknown> | undefined
      if (from !== undefined && typeof from['amount'] === 'string') {
        from['amount'] = BigInt(from['amount'])
      }
    } else if (kind === 'contract_call') {
      const value = action['value'] as Record<string, unknown> | undefined
      if (value !== undefined && typeof value['amount'] === 'string') {
        value['amount'] = BigInt(value['amount'])
      }
    }
  }

  return raw as unknown as SuccessReceipt
}

export function createFileReceiptStore(filePath: string): ReceiptStore {
  return {
    save(receipt: SuccessReceipt): Promise<void> {
      mkdirSync(dirname(filePath), { recursive: true })
      const line = JSON.stringify(receipt, replacer)
      appendFileSync(filePath, line + '\n', 'utf-8')
      return Promise.resolve()
    },

    get(txHash: string): Promise<SuccessReceipt | null> {
      if (!existsSync(filePath)) return Promise.resolve(null)
      const lines = readFileSync(filePath, 'utf-8').split('\n').filter((l: string) => l.length > 0)
      for (const line of lines) {
        const raw = JSON.parse(line) as Record<string, unknown>
        if (raw['txHash'] === txHash) {
          return Promise.resolve(reviveBigIntFields(raw))
        }
      }
      return Promise.resolve(null)
    },

    list(filter?: ReceiptFilter): Promise<SuccessReceipt[]> {
      if (!existsSync(filePath)) return Promise.resolve([])
      const lines = readFileSync(filePath, 'utf-8').split('\n').filter((l: string) => l.length > 0)
      let result = lines.map((line: string) => reviveBigIntFields(JSON.parse(line) as Record<string, unknown>))
      if (filter !== undefined) {
        if (filter.chain !== undefined) {
          const chain = filter.chain
          result = result.filter((r: SuccessReceipt) => (r.action as { chain: string }).chain === chain)
        }
        if (filter.from !== undefined) {
          const from = filter.from
          result = result.filter((r: SuccessReceipt) => r.confirmedAtBlock >= from)
        }
        if (filter.to !== undefined) {
          const to = filter.to
          result = result.filter((r: SuccessReceipt) => r.confirmedAtBlock <= to)
        }
      }
      return Promise.resolve(result)
    },
  }
}
