import type { Policy } from '@txfence/core'
import type { AuditEntry } from './types.js'

export function bigintReplacer(_: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v
}

export function serializeEntry(entry: AuditEntry): string {
  return JSON.stringify(entry, bigintReplacer)
}

export function deserializeEntry(raw: string): AuditEntry {
  const parsed = JSON.parse(raw) as Record<string, unknown>

  // Revive policy bigints
  const policy = parsed['policySnapshot'] as Record<string, unknown>
  const maxSpend = policy['maxSpendPerTx'] as Record<string, unknown>
  maxSpend['amount'] = BigInt(maxSpend['amount'] as string)
  const threshold = policy['humanApprovalThreshold'] as Record<string, unknown>
  threshold['amount'] = BigInt(threshold['amount'] as string)
  const capLocks = policy['capLocks']
  if (Array.isArray(capLocks)) {
    for (const cap of capLocks) {
      const c = cap as Record<string, unknown>
      const absCap = c['absoluteCap'] as Record<string, unknown> | undefined
      if (absCap !== undefined) {
        absCap['maxAmount'] = BigInt(absCap['maxAmount'] as string)
      }
      const rolWin = c['rollingWindow'] as Record<string, unknown> | undefined
      if (rolWin !== undefined) {
        rolWin['maxAmount'] = BigInt(rolWin['maxAmount'] as string)
      }
    }
  }

  // Revive action bigints
  const action = parsed['action'] as Record<string, unknown>
  if (action['kind'] === 'transfer') {
    const token = action['token'] as Record<string, unknown>
    token['amount'] = BigInt(token['amount'] as string)
  }
  if (action['kind'] === 'swap') {
    const from = action['from'] as Record<string, unknown>
    from['amount'] = BigInt(from['amount'] as string)
    if (action['value'] !== undefined && action['value'] !== null) {
      const value = action['value'] as Record<string, unknown>
      value['amount'] = BigInt(value['amount'] as string)
    }
  }
  if (action['kind'] === 'contract_call') {
    if (action['value'] !== undefined && action['value'] !== null) {
      const value = action['value'] as Record<string, unknown>
      value['amount'] = BigInt(value['amount'] as string)
    }
  }

  // Revive simulation bigints
  const sim = parsed['simulation']
  if (sim !== undefined && sim !== null) {
    const simObj = sim as Record<string, unknown>
    simObj['gasEstimate'] = BigInt(simObj['gasEstimate'] as string)
  }

  // gasUsed in outcome stays as string — intentional
  return parsed as unknown as AuditEntry
}

export function clonePolicy(policy: Policy): Policy {
  const cloned = JSON.parse(JSON.stringify(policy, bigintReplacer)) as Record<string, unknown>

  const maxSpend = cloned['maxSpendPerTx'] as Record<string, unknown>
  maxSpend['amount'] = BigInt(maxSpend['amount'] as string)
  const threshold = cloned['humanApprovalThreshold'] as Record<string, unknown>
  threshold['amount'] = BigInt(threshold['amount'] as string)

  const capLocks = cloned['capLocks']
  if (Array.isArray(capLocks)) {
    for (const cap of capLocks) {
      const c = cap as Record<string, unknown>
      const absCap = c['absoluteCap'] as Record<string, unknown> | undefined
      if (absCap !== undefined) {
        absCap['maxAmount'] = BigInt(absCap['maxAmount'] as string)
      }
      const rolWin = c['rollingWindow'] as Record<string, unknown> | undefined
      if (rolWin !== undefined) {
        rolWin['maxAmount'] = BigInt(rolWin['maxAmount'] as string)
      }
    }
  }

  return cloned as unknown as Policy
}
