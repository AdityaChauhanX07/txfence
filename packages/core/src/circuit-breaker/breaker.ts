import type { CircuitBreaker, CircuitBreakerConfig, CircuitBreakerState } from './types.js'

export function createCircuitBreaker(config?: CircuitBreakerConfig): CircuitBreaker {
  const failureThreshold = config?.failureThreshold ?? 5
  const successThreshold = config?.successThreshold ?? 2
  const timeoutMs = config?.timeoutMs ?? 60_000
  const onStateChange = config?.onStateChange

  let currentState: CircuitBreakerState = 'closed'
  let consecutiveFailures = 0
  let consecutiveSuccesses = 0
  let openedAt: number | null = null

  function transition(to: CircuitBreakerState): void {
    if (currentState === to) return
    const from = currentState
    currentState = to
    if (to === 'open') {
      openedAt = Date.now()
      consecutiveFailures = 0
      consecutiveSuccesses = 0
    }
    if (to === 'closed') {
      consecutiveFailures = 0
      consecutiveSuccesses = 0
      openedAt = null
    }
    if (to === 'half-open') {
      consecutiveSuccesses = 0
    }
    onStateChange?.(from, to)
  }

  function state(): CircuitBreakerState {
    if (currentState === 'open' && openedAt !== null) {
      if (Date.now() - openedAt >= timeoutMs) {
        transition('half-open')
      }
    }
    return currentState
  }

  function isOpen(): boolean {
    return state() === 'open'
  }

  function recordSuccess(): void {
    const s = state()
    if (s === 'half-open') {
      consecutiveSuccesses++
      if (consecutiveSuccesses >= successThreshold) {
        transition('closed')
      }
    } else if (s === 'closed') {
      consecutiveFailures = 0
    }
  }

  function recordFailure(): void {
    const s = state()
    if (s === 'half-open') {
      transition('open')
    } else if (s === 'closed') {
      consecutiveFailures++
      if (consecutiveFailures >= failureThreshold) {
        transition('open')
      }
    }
    // If already open, recordFailure is a no-op
  }

  function reset(): void {
    transition('closed')
  }

  return { state, isOpen, recordSuccess, recordFailure, reset }
}
