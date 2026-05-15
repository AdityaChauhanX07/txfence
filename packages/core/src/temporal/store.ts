// In-memory EventStore for temporal policy evaluation.
// Maintains a sliding window of pipeline events.
// Auto-prunes events older than the largest configured window
// to prevent unbounded memory growth.
//
// For multi-agent distributed deployments, use the Redis-backed
// EventStore in @txfence/redis (planned) — it shares the sliding
// window across processes via sorted sets.

import type { EventStore, PipelineEvent, EventFilter } from './types.js'

export function createMemoryEventStore(options?: {
  maxWindowMs?: number
  maxEvents?: number
}): EventStore {
  const maxWindowMs = options?.maxWindowMs ?? 24 * 60 * 60 * 1000
  const maxEvents = options?.maxEvents ?? 10_000

  const events: PipelineEvent[] = []

  function pruneIfNeeded(): void {
    const cutoff = Date.now() - maxWindowMs
    while (events.length > 0 && events[0]!.timestamp < cutoff) {
      events.shift()
    }
    while (events.length > maxEvents) {
      events.shift()
    }
  }

  function record(event: PipelineEvent): void {
    events.push(event)
    pruneIfNeeded()
  }

  function prune(olderThan: number): void {
    let i = 0
    while (i < events.length && events[i]!.timestamp < olderThan) {
      i++
    }
    events.splice(0, i)
  }

  function applyFilter(
    pool: PipelineEvent[],
    filter?: EventFilter,
  ): PipelineEvent[] {
    if (filter === undefined) return [...pool]

    const now = Date.now()
    const from =
      filter.from ??
      (filter.windowMs !== undefined ? now - filter.windowMs : undefined)
    const to = filter.to

    return pool.filter(e => {
      if (filter.agentId !== undefined && e.agentId !== filter.agentId) {
        return false
      }
      if (filter.chain !== undefined && e.chain !== filter.chain) return false
      if (filter.status !== undefined && e.outcome.status !== filter.status) {
        return false
      }
      if (from !== undefined && e.timestamp < from) return false
      if (to !== undefined && e.timestamp > to) return false
      if (filter.contractAddress !== undefined) {
        if (e.action.kind !== 'contract_call') return false
        if (e.action.contract !== filter.contractAddress) return false
      }
      return true
    })
  }

  function query(filter?: EventFilter): PipelineEvent[] {
    return applyFilter(events, filter)
  }

  function recent(
    n: number,
    filter?: Omit<EventFilter, 'from' | 'to' | 'windowMs'>,
  ): PipelineEvent[] {
    const filtered = applyFilter(events, filter as EventFilter | undefined)
    return filtered.slice(-n).reverse()
  }

  return { record, query, prune, recent }
}
