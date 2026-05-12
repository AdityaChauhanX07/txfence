import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCircuitBreaker } from './breaker.js'
import { wrapAdapterWithCircuitBreaker } from './wrap-adapter.js'
import type { ChainAdapter } from '../agent/adapter.js'
import type { SimulationResult } from '../types/simulation.js'
import type { Action } from '../types/action.js'

const makeSuccessResult = (): SimulationResult => ({
  success: true,
  wouldRevert: false,
  chain: 'ethereum',
  simulatedAtBlock: 100,
  gasEstimate: 21000n,
  gasBufferApplied: 1.2,
  coverageLevel: 'basic',
  caveats: [],
  provider: 'eth_call',
})

const makeRevertResult = (): SimulationResult => ({
  success: false,
  wouldRevert: true,
  chain: 'ethereum',
  simulatedAtBlock: 100,
  gasEstimate: 0n,
  gasBufferApplied: 1.0,
  coverageLevel: 'basic',
  caveats: [],
  provider: 'eth_call',
})

const testAction: Action = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'ETH', amount: 1n, decimals: 18 },
  to: '0x2',
}

describe('createCircuitBreaker', () => {
  it('starts in closed state', () => {
    const breaker = createCircuitBreaker()
    expect(breaker.state()).toBe('closed')
    expect(breaker.isOpen()).toBe(false)
  })

  it('opens after failureThreshold consecutive failures', () => {
    const breaker = createCircuitBreaker({ failureThreshold: 3 })
    breaker.recordFailure()
    breaker.recordFailure()
    expect(breaker.state()).toBe('closed')
    breaker.recordFailure()
    expect(breaker.state()).toBe('open')
    expect(breaker.isOpen()).toBe(true)
  })

  it('resets failure count on success in closed state', () => {
    const breaker = createCircuitBreaker({ failureThreshold: 3 })
    breaker.recordFailure()
    breaker.recordFailure()
    breaker.recordSuccess()
    breaker.recordFailure()
    breaker.recordFailure()
    expect(breaker.state()).toBe('closed')
    breaker.recordFailure()
    expect(breaker.state()).toBe('open')
  })

  it('transitions to half-open after timeoutMs elapses', () => {
    const breaker = createCircuitBreaker({ failureThreshold: 1, timeoutMs: 50 })
    breaker.recordFailure()
    expect(breaker.state()).toBe('open')
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(breaker.state()).toBe('half-open')
        resolve()
      }, 60)
    })
  })

  it('closes from half-open after successThreshold successes', () => {
    const breaker = createCircuitBreaker({ failureThreshold: 1, successThreshold: 2, timeoutMs: 50 })
    breaker.recordFailure()
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(breaker.state()).toBe('half-open')
        breaker.recordSuccess()
        expect(breaker.state()).toBe('half-open')
        breaker.recordSuccess()
        expect(breaker.state()).toBe('closed')
        resolve()
      }, 60)
    })
  })

  it('re-opens from half-open on failure', () => {
    const breaker = createCircuitBreaker({ failureThreshold: 1, timeoutMs: 50 })
    breaker.recordFailure()
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(breaker.state()).toBe('half-open')
        breaker.recordFailure()
        expect(breaker.state()).toBe('open')
        resolve()
      }, 60)
    })
  })

  it('recordFailure is a no-op when already open', () => {
    const onStateChange = vi.fn()
    const breaker = createCircuitBreaker({ failureThreshold: 1, onStateChange })
    breaker.recordFailure()
    expect(breaker.state()).toBe('open')
    const callCount = onStateChange.mock.calls.length
    breaker.recordFailure()
    expect(onStateChange.mock.calls.length).toBe(callCount)
  })

  it('reset() transitions to closed from any state', () => {
    const breaker = createCircuitBreaker({ failureThreshold: 1 })
    breaker.recordFailure()
    expect(breaker.state()).toBe('open')
    breaker.reset()
    expect(breaker.state()).toBe('closed')
  })

  it('calls onStateChange with from/to on each transition', () => {
    const onStateChange = vi.fn()
    const breaker = createCircuitBreaker({ failureThreshold: 1, onStateChange })
    breaker.recordFailure()
    expect(onStateChange).toHaveBeenCalledWith('closed', 'open')
    breaker.reset()
    expect(onStateChange).toHaveBeenCalledWith('open', 'closed')
  })
})

describe('wrapAdapterWithCircuitBreaker', () => {
  let simulate: ReturnType<typeof vi.fn>
  let adapter: ChainAdapter
  let breaker: ReturnType<typeof createCircuitBreaker>

  beforeEach(() => {
    simulate = vi.fn()
    adapter = { simulate: simulate as ChainAdapter['simulate'] }
    breaker = createCircuitBreaker({ failureThreshold: 2 })
  })

  it('passes through to adapter when breaker is closed', async () => {
    simulate.mockResolvedValue(makeSuccessResult())
    const wrapped = wrapAdapterWithCircuitBreaker(adapter, breaker, 'ethereum')
    const result = await wrapped.simulate(testAction, 'ethereum', 'http://rpc')
    expect(result.success).toBe(true)
    expect(simulate).toHaveBeenCalledOnce()
  })

  it('returns failure immediately without calling adapter when breaker is open', async () => {
    breaker.recordFailure()
    breaker.recordFailure()
    expect(breaker.isOpen()).toBe(true)
    const wrapped = wrapAdapterWithCircuitBreaker(adapter, breaker, 'ethereum')
    const result = await wrapped.simulate(testAction, 'ethereum', 'http://rpc')
    expect(result.success).toBe(false)
    expect(result.coverageLevel).toBe('none')
    expect(simulate).not.toHaveBeenCalled()
  })

  it('records success on successful simulation', async () => {
    simulate.mockResolvedValue(makeSuccessResult())
    const recordSuccess = vi.spyOn(breaker, 'recordSuccess')
    const wrapped = wrapAdapterWithCircuitBreaker(adapter, breaker, 'ethereum')
    await wrapped.simulate(testAction, 'ethereum', 'http://rpc')
    expect(recordSuccess).toHaveBeenCalledOnce()
  })

  it('does not record failure when simulation returns wouldRevert (RPC worked)', async () => {
    simulate.mockResolvedValue(makeRevertResult())
    const recordFailure = vi.spyOn(breaker, 'recordFailure')
    const wrapped = wrapAdapterWithCircuitBreaker(adapter, breaker, 'ethereum')
    const result = await wrapped.simulate(testAction, 'ethereum', 'http://rpc')
    expect(result.wouldRevert).toBe(true)
    expect(recordFailure).not.toHaveBeenCalled()
  })

  it('records failure and returns failed result when adapter throws', async () => {
    simulate.mockRejectedValue(new Error('RPC timeout'))
    const recordFailure = vi.spyOn(breaker, 'recordFailure')
    const wrapped = wrapAdapterWithCircuitBreaker(adapter, breaker, 'ethereum')
    const result = await wrapped.simulate(testAction, 'ethereum', 'http://rpc')
    expect(result.success).toBe(false)
    expect(result.coverageLevel).toBe('none')
    expect(recordFailure).toHaveBeenCalledOnce()
  })

  it('opens the breaker after repeated adapter throws', async () => {
    simulate.mockRejectedValue(new Error('RPC down'))
    const wrapped = wrapAdapterWithCircuitBreaker(adapter, breaker, 'ethereum')
    await wrapped.simulate(testAction, 'ethereum', 'http://rpc')
    await wrapped.simulate(testAction, 'ethereum', 'http://rpc')
    expect(breaker.isOpen()).toBe(true)
    await wrapped.simulate(testAction, 'ethereum', 'http://rpc')
    expect(simulate).toHaveBeenCalledTimes(2)
  })
})
