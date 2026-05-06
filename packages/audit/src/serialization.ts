import type { Policy } from '@txfence/core'
import {
  bigintReplacer,
  reviveAction,
  revivePolicy,
  reviveSimulationResult,
} from '@txfence/core'
import type { AuditEntry } from './types.js'

export { bigintReplacer }

export function serializeEntry(entry: AuditEntry): string {
  return JSON.stringify(entry, bigintReplacer)
}

export function deserializeEntry(raw: string): AuditEntry {
  const parsed = JSON.parse(raw) as Record<string, unknown>

  if (parsed['action'] !== undefined) {
    reviveAction(parsed['action'] as Record<string, unknown>)
  }

  if (parsed['policySnapshot'] !== undefined) {
    revivePolicy(parsed['policySnapshot'] as Record<string, unknown>)
  }

  if (parsed['simulation'] !== undefined) {
    reviveSimulationResult(parsed['simulation'] as Record<string, unknown>)
  }

  // outcome.gasUsed is stored as string intentionally — keep as string
  // ApprovalRequest fields do not contain bigints

  return parsed as unknown as AuditEntry
}

export function clonePolicy(policy: Policy): Policy {
  const cloned = JSON.parse(JSON.stringify(policy, bigintReplacer)) as Record<string, unknown>
  revivePolicy(cloned)
  return cloned as unknown as Policy
}
