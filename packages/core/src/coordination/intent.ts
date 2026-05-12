import { createHash } from 'node:crypto'
import { bigintReplacer } from '../serialization/bigint.js'
import type { Action } from '../types/action.js'

export function getIntentId(action: Action): string {
  const canonical = JSON.stringify(action, bigintReplacer)
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32)
}

export function getIntentIdWithNonce(action: Action, nonce: string): string {
  const canonical = JSON.stringify({ action, nonce }, bigintReplacer)
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32)
}
