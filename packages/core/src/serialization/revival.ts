import type { SuccessReceipt } from '../types/receipt.js'

export function reviveTokenAmount(obj: Record<string, unknown>): void {
  if (typeof obj['amount'] === 'string') {
    obj['amount'] = BigInt(obj['amount'])
  }
}

export function revivePolicy(obj: Record<string, unknown>): void {
  reviveTokenAmount(obj['maxSpendPerTx'] as Record<string, unknown>)
  reviveTokenAmount(obj['humanApprovalThreshold'] as Record<string, unknown>)

  if (Array.isArray(obj['capLocks'])) {
    for (const lock of obj['capLocks'] as unknown[]) {
      const l = lock as Record<string, unknown>
      if (l['absoluteCap'] !== undefined) {
        const ac = l['absoluteCap'] as Record<string, unknown>
        if (typeof ac['maxAmount'] === 'string') {
          ac['maxAmount'] = BigInt(ac['maxAmount'])
        }
      }
      if (l['rollingWindow'] !== undefined) {
        const rw = l['rollingWindow'] as Record<string, unknown>
        if (typeof rw['maxAmount'] === 'string') {
          rw['maxAmount'] = BigInt(rw['maxAmount'])
        }
      }
    }
  }
}

export function reviveAction(obj: Record<string, unknown>): void {
  switch (obj['kind']) {
    case 'transfer': {
      const token = obj['token'] as Record<string, unknown>
      if (typeof token['amount'] === 'string') {
        token['amount'] = BigInt(token['amount'])
      }
      break
    }
    case 'swap': {
      const from = obj['from'] as Record<string, unknown>
      if (typeof from['amount'] === 'string') {
        from['amount'] = BigInt(from['amount'])
      }
      if (obj['value'] !== undefined) {
        const value = obj['value'] as Record<string, unknown>
        if (typeof value['amount'] === 'string') {
          value['amount'] = BigInt(value['amount'])
        }
      }
      break
    }
    case 'contract_call': {
      if (obj['value'] !== undefined) {
        const value = obj['value'] as Record<string, unknown>
        if (typeof value['amount'] === 'string') {
          value['amount'] = BigInt(value['amount'])
        }
      }
      break
    }
  }
}

export function reviveSimulationResult(obj: Record<string, unknown>): void {
  if (typeof obj['gasEstimate'] === 'string') {
    obj['gasEstimate'] = BigInt(obj['gasEstimate'])
  }
}

export function reviveSuccessReceipt(obj: Record<string, unknown>): SuccessReceipt {
  if (typeof obj['gasUsed'] === 'string') {
    obj['gasUsed'] = BigInt(obj['gasUsed'])
  }
  if (obj['action'] !== undefined) {
    reviveAction(obj['action'] as Record<string, unknown>)
  }
  if (obj['simulation'] !== undefined) {
    reviveSimulationResult(obj['simulation'] as Record<string, unknown>)
  }
  if (obj['policySnapshot'] !== undefined) {
    revivePolicy(obj['policySnapshot'] as Record<string, unknown>)
  }
  return obj as unknown as SuccessReceipt
}
