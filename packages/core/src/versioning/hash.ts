// Policy versioning uses SHA-256 of the canonical JSON representation.
// Canonical means: keys sorted, bigints serialized as strings, no whitespace.
// Two policies with identical fields always produce the same ID regardless
// of the order fields were defined in source code.

import { createHash } from 'node:crypto'
import type { Policy } from '../types/policy.js'
import type { PolicyVersion } from './types.js'

function canonicalize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as object).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}

export function getPolicyVersionId(policy: Policy): string {
  const canonical = JSON.stringify(canonicalize(policy))
  return createHash('sha256').update(canonical).digest('hex')
}

export function createPolicyVersion(
  policy: Policy,
  meta?: { label?: string; author?: string },
): PolicyVersion {
  return {
    id: getPolicyVersionId(policy),
    policy,
    createdAt: Date.now(),
    ...(meta?.label !== undefined ? { label: meta.label } : {}),
    ...(meta?.author !== undefined ? { author: meta.author } : {}),
  }
}
