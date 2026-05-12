import { describe, it, expect, vi } from 'vitest'
import { executeIntent } from './execute.js'
import type { Intent, IntentStep, IntentPolicy } from './types.js'
import type { Policy } from '../types/policy.js'
import type { SuccessReceipt } from '../types/receipt.js'

const txPolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'USDC', amount: 10000n, decimals: 6 },
  allowedContracts: [],
  requireSimulation: false,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 100000n, decimals: 6 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent',
}

const makeStep = (
  id: string,
  amount: bigint,
  dependsOn?: string[],
  optional?: boolean,
): IntentStep => ({
  id,
  action: {
    kind: 'transfer' as const,
    chain: 'ethereum' as const,
    token: { token: 'USDC', amount, decimals: 6 },
    to: '0x0000000000000000000000000000000000000001',
  },
  ...(dependsOn !== undefined ? { dependsOn } : {}),
  ...(optional !== undefined ? { optional } : {}),
})

const makeIntent = (steps: IntentStep[], intentPolicy?: IntentPolicy): Intent => ({
  id: 'exec-test-intent',
  steps,
  ...(intentPolicy !== undefined ? { intentPolicy } : {}),
})

const makeReceipt = (): SuccessReceipt => ({
  status: 'success',
  action: {
    kind: 'transfer', chain: 'ethereum',
    token: { token: 'USDC', amount: 1000n, decimals: 6 },
    to: '0x0000000000000000000000000000000000000001',
  },
  policyEvaluation: { passed: true, checksRun: ['checkChain'] },
  simulation: {
    success: true, wouldRevert: false, chain: 'ethereum',
    simulatedAtBlock: 1000, gasEstimate: 21000n, gasBufferApplied: 1.2,
    coverageLevel: 'basic', caveats: [], provider: 'eth_call',
  },
  txHash: '0xmock',
  confirmedAtBlock: 1000,
  confirmedAtMs: Date.now(),
  gasUsed: 21000n,
})

const successExecutor = vi.fn().mockImplementation(async () => makeReceipt())
const failingExecutor = vi.fn().mockRejectedValue(new Error('RPC error'))

const baseOptions = {
  adapters: {},
  rpcUrls: { ethereum: 'http://mock-rpc' },
  executor: successExecutor,
}

// ── basic execution ───────────────────────────────────────────────────────────

describe('executeIntent — basic execution', () => {
  it('completes a single step intent', async () => {
    const intent = makeIntent([makeStep('A', 1000n)])
    const result = await executeIntent(intent, txPolicy, baseOptions)
    expect(result.status).toBe('completed')
    expect(result.completedStepIds).toContain('A')
    expect(result.failedStepIds).toHaveLength(0)
    expect(result.intentId).toBe('exec-test-intent')
  })

  it('completes a linear chain A → B → C', async () => {
    const intent = makeIntent([
      makeStep('A', 1000n),
      makeStep('B', 1000n, ['A']),
      makeStep('C', 1000n, ['B']),
    ])
    const result = await executeIntent(intent, txPolicy, baseOptions)
    expect(result.status).toBe('completed')
    expect(result.completedStepIds).toHaveLength(3)
  })

  it('stores receipts by stepId', async () => {
    const intent = makeIntent([makeStep('A', 1000n)])
    const result = await executeIntent(intent, txPolicy, baseOptions)
    expect(result.receipts['A']).toBeDefined()
  })

  it('returns durationMs', async () => {
    const intent = makeIntent([makeStep('A', 1000n)])
    const result = await executeIntent(intent, txPolicy, baseOptions)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })
})

// ── failure handling ──────────────────────────────────────────────────────────

describe('executeIntent — failure handling', () => {
  it('returns rejected when intent policy evaluation fails', async () => {
    const intent = makeIntent(
      [makeStep('A', 1000n)],
      { allowedChains: ['solana'] },
    )
    const result = await executeIntent(intent, txPolicy, baseOptions)
    expect(result.status).toBe('rejected')
    expect(result.completedStepIds).toHaveLength(0)
  })

  it('skips dependent steps when required step fails', async () => {
    const options = { ...baseOptions, executor: failingExecutor }
    const intent = makeIntent([
      makeStep('A', 1000n),
      makeStep('B', 1000n, ['A']),
      makeStep('C', 1000n, ['B']),
    ])
    const result = await executeIntent(intent, txPolicy, options)
    expect(result.failedStepIds).toContain('A')
    expect(result.skippedStepIds).toContain('B')
    expect(result.skippedStepIds).toContain('C')
    expect(result.status).toBe('failed')
  })

  it('does not poison dependents when optional step fails', async () => {
    const options = { ...baseOptions, executor: failingExecutor }
    const intent = makeIntent([
      makeStep('A', 1000n, undefined, true),
      makeStep('B', 1000n),
    ])
    const result = await executeIntent(intent, txPolicy, options)
    expect(result.skippedStepIds).not.toContain('B')
  })

  it('returns partial when some required steps fail and some succeed', async () => {
    let callCount = 0
    const partialExecutor = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount === 2) throw new Error('step 2 failed')
      return makeReceipt()
    })
    const intent = makeIntent([
      makeStep('A', 1000n),
      makeStep('B', 1000n),
      makeStep('C', 1000n),
    ])
    const result = await executeIntent(intent, txPolicy, {
      ...baseOptions,
      executor: partialExecutor,
    })
    expect(result.completedStepIds.length).toBeGreaterThan(0)
    expect(result.failedStepIds.length).toBeGreaterThan(0)
    expect(result.status).toBe('partial')
  })
})

// ── timeout ───────────────────────────────────────────────────────────────────

describe('executeIntent — timeout', () => {
  it('marks remaining steps as abandoned when maxDurationMs exceeded', async () => {
    const slowExecutor = vi.fn().mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 50))
      return makeReceipt()
    })
    const intent = makeIntent(
      [makeStep('A', 1000n), makeStep('B', 1000n), makeStep('C', 1000n)],
      { maxDurationMs: 30 },
    )
    const result = await executeIntent(intent, txPolicy, {
      ...baseOptions,
      executor: slowExecutor,
    })
    expect(result.status).toBe('timed_out')
  })
})
