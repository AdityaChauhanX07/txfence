// Shared bigint serialization utilities for txfence storage backends.
// JSON does not support bigint natively. These utilities provide a consistent
// approach across all storage implementations.
// Do not use JSON.parse with a reviver for bigint revival — the reviver
// cannot distinguish which string fields should be bigints. Use the typed
// revival functions in revival.ts instead.

export function bigintReplacer(_: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v
}

export function bigintReviver(_: string, v: unknown): unknown {
  // NOTE: this reviver is intentionally NOT used as a JSON.parse reviver
  // because it cannot know which string fields are bigints and which are not.
  // Use the typed revival functions below instead.
  return v
}

export function serializeWithBigInt(obj: unknown): string {
  return JSON.stringify(obj, bigintReplacer)
}

export function parseWithBigInt(json: string): unknown {
  return JSON.parse(json)
}
