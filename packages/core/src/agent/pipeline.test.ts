import { describe, it, expect, vi } from 'vitest'
import type { Policy } from '../types/policy.js'
import type { SwapAction } from '../types/action.js'
import type { SimulationResult } from '../types/simulation.js'
import type { ChainAdapter } from './adapter.js'
import { runPipeline } from './pipeline.js'

// ── fixtures ─────────────────────────────────────────────────────────────────

const basePolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'USDC', amount: 500n, decimals: 6 },
  allowedContracts: [{ address: '0xUNISWAP', chain: 'ethereum' }],
  requireSimulation: false,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent',
}

const baseSwap: SwapAction = {
  kind: 'swap',
  chain: 'ethereum',
  from: { token: 'USDC', amount: 100n, decimals: 6 },
  to: 'ETH',
  via: '0xUNISWAP',
  maxSlippage: 50,
}

const passingSim: SimulationResult = {
  success: true,
  wouldRevert: false,
  chain: 'ethereum',
  simulatedAtBlock: 1000,
  gasEstimate: 100000n,
  gasBufferApplied: 1.3,
  coverageLevel: 'basic',
  caveats: ['state_may_diverge'],
  provider: 'eth_call',
}

const failingSimulation: SimulationResult = {
  success: false,
  wouldRevert: false,
  chain: 'ethereum',
  simulatedAtBlock: 0,
  gasEstimate: 0n,
  gasBufferApplied: 0,
  coverageLevel: 'none',
  caveats: ['state_may_diverge'],
  provider: 'eth_call',
}

function mockAdapter(result: SimulationResult): ChainAdapter {
  return { simulate: vi.fn().mockResolvedValue(result) }
}

const emptyAdapters = {}
const rpcUrls = { ethereum: 'https://example.com' }

// ── policy rejection before simulation ───────────────────────────────────────

describe('runPipeline — policy rejection before simulation', () => {
  it('returns policy_rejected when chain is not in policy chains', async () => {
    const action: SwapAction = { ...baseSwap, chain: 'solana' }
    const result = await runPipeline(action, basePolicy, emptyAdapters, rpcUrls)
    expect(result.status).toBe('policy_rejected')
    if (result.status === 'policy_rejected') {
      expect(result.evaluation.passed).toBe(false)
    }
  })

  it('returns policy_rejected when contract is not on allowlist', async () => {
    const action: SwapAction = { ...baseSwap, via: '0xUNKNOWN' }
    const result = await runPipeline(action, basePolicy, emptyAdapters, rpcUrls)
    expect(result.status).toBe('policy_rejected')
  })

  it('returns policy_rejected when spend exceeds cap', async () => {
    const action: SwapAction = {
      ...baseSwap,
      from: { token: 'USDC', amount: 600n, decimals: 6 },
    }
    const result = await runPipeline(action, basePolicy, emptyAdapters, rpcUrls)
    expect(result.status).toBe('policy_rejected')
  })

  it('returns policy_rejected when slippage is not declared', async () => {
    const action: SwapAction = { ...baseSwap, maxSlippage: 0 }
    const result = await runPipeline(action, basePolicy, emptyAdapters, rpcUrls)
    expect(result.status).toBe('policy_rejected')
  })
})

// ── simulation ────────────────────────────────────────────────────────────────

describe('runPipeline — simulation', () => {
  it('returns simulation_failed when adapter returns a failing simulation', async () => {
    const policy: Policy = { ...basePolicy, requireSimulation: true }
    const adapters = { ethereum: mockAdapter(failingSimulation) }
    const result = await runPipeline(baseSwap, policy, adapters, rpcUrls)
    expect(result.status).toBe('simulation_failed')
  })

  it('returns policy_rejected when no adapter is configured for the chain', async () => {
    const policy: Policy = { ...basePolicy, requireSimulation: true }
    const result = await runPipeline(baseSwap, policy, emptyAdapters, rpcUrls)
    expect(result.status).toBe('policy_rejected')
  })

  it('proceeds past simulation when adapter returns a passing simulation', async () => {
    const policy: Policy = { ...basePolicy, requireSimulation: true }
    const adapters = { ethereum: mockAdapter(passingSim) }
    const result = await runPipeline(baseSwap, policy, adapters, rpcUrls)
    expect(result.status).not.toBe('policy_rejected')
    expect(result.status).not.toBe('simulation_failed')
  })

  it('calls the adapter with the correct chain and rpcUrl', async () => {
    const policy: Policy = { ...basePolicy, requireSimulation: true }
    const adapter = mockAdapter(passingSim)
    const adapters = { ethereum: adapter }
    await runPipeline(baseSwap, policy, adapters, rpcUrls)
    expect(adapter.simulate).toHaveBeenCalledWith(baseSwap, 'ethereum', 'https://example.com')
  })
})

// ── human approval threshold ──────────────────────────────────────────────────

describe('runPipeline — human approval threshold', () => {
  it('returns approval_timeout when spend exceeds humanApprovalThreshold', async () => {
    const policy: Policy = {
      ...basePolicy,
      maxSpendPerTx: { token: 'USDC', amount: 50000n, decimals: 6 },
      allowedContracts: [{ address: '0xUNISWAP', chain: 'ethereum' }],
    }
    const action: SwapAction = {
      ...baseSwap,
      from: { token: 'USDC', amount: 20000n, decimals: 6 },
    }
    const result = await runPipeline(action, policy, emptyAdapters, rpcUrls)
    expect(result.status).toBe('approval_timeout')
  })
})

// ── execution placeholder ─────────────────────────────────────────────────────

describe('runPipeline — execution placeholder', () => {
  it('returns execution_failed with the placeholder reason when all checks pass', async () => {
    const result = await runPipeline(baseSwap, basePolicy, emptyAdapters, rpcUrls)
    expect(result.status).toBe('execution_failed')
    if (result.status === 'execution_failed') {
      expect(result.reason).toContain('not yet implemented')
    }
  })
})
