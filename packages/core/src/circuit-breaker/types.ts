export type CircuitBreakerState = 'closed' | 'open' | 'half-open'

export type CircuitBreakerConfig = {
  failureThreshold?: number   // consecutive failures before opening (default 5)
  successThreshold?: number   // consecutive successes in half-open to close (default 2)
  timeoutMs?: number          // ms before trying half-open after opening (default 60000)
  onStateChange?: (from: CircuitBreakerState, to: CircuitBreakerState) => void
}

export type CircuitBreaker = {
  state: () => CircuitBreakerState
  isOpen: () => boolean
  recordSuccess: () => void
  recordFailure: () => void
  reset: () => void
}
