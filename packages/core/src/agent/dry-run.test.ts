import { describe, it, expect, vi } from 'vitest'
import { runDryRun } from './run-dry.js'
import { createMemoryCapLockProvider } from '../caps/memory.js'
import type { Policy } from '../types/policy.js'
import type { TransferAction } from '../types/action.js'
import type { SimulationResult } from '../types/simulation.js'
import type { ChainAdapter } from './adapter.js'

const basePolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'ETH', amount: 1000000000000000000n, decimals: 18 },
  allowedContracts: [],
  requireSimulation: false,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'ETH', amount: 10000000000000000000n, decimals: 18 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent',
}

const smallTransfer: TransferAction = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}

const passingSim: SimulationResult = {
  success: true,
  wouldRevert: false,
  chain: 'ethereum',
  simulatedAtBlock: 1000,
  gasEstimate: 21000n,
  gasBufferApplied: 1.2,
  coverageLevel: 'basic',
  caveats: ['state_may_diverge'],
  provider: 'eth_call',
}

// ── policy checks ─────────────────────────────────────────────────────────────

describe('runDryRun — policy checks', () => {
  it('returns wouldProceed: true for a valid action', async () => {
    const result = await runDryRun(smallTransfer, basePolicy, {}, {})
    expect(result.wouldProceed).toBe(true)
    expect(result.blockers).toHaveLength(0)
    expect(result.evaluation.passed).toBe(true)
  })

  it('returns policy_rejected blocker when policy fails', async () => {
    const strictPolicy: Policy = {
      ...basePolicy,
      chains: ['solana'],
    }
    const result = await runDryRun(smallTransfer, strictPolicy, {}, {})
    expect(result.wouldProceed).toBe(false)
    expect(result.blockers.some(b => b.kind === 'policy_rejected')).toBe(true)
  })

  it('returns approval_required blocker when spend exceeds threshold', async () => {
    const lowThresholdPolicy: Policy = {
      ...basePolicy,
      humanApprovalThreshold: { token: 'ETH', amount: 1n, decimals: 18 },
    }
    const result = await runDryRun(smallTransfer, lowThresholdPolicy, {}, {})
    expect(result.approvalRequired).toBe(true)
    expect(result.blockers.some(b => b.kind === 'approval_required')).toBe(true)
    expect(result.wouldProceed).toBe(false)
  })

  it('returns simulation_failed blocker when requireSimulation and no adapter', async () => {
    const simPolicy: Policy = { ...basePolicy, requireSimulation: true }
    const result = await runDryRun(smallTransfer, simPolicy, {}, {})
    expect(result.blockers.some(b => b.kind === 'simulation_failed')).toBe(true)
    expect(result.wouldProceed).toBe(false)
  })

  it('runs simulation when adapter provided', async () => {
    const mockAdapter: ChainAdapter = { simulate: vi.fn().mockResolvedValue(passingSim) }
    const result = await runDryRun(
      smallTransfer, basePolicy,
      { ethereum: mockAdapter },
      { ethereum: 'http://mock' },
    )
    expect(mockAdapter.simulate).toHaveBeenCalledOnce()
    expect(result.simulation).toBeDefined()
    expect(result.simulation?.success).toBe(true)
  })

  it('returns cap_lock_unavailable when cap is exhausted', async () => {
    const capPolicy: Policy = {
      ...basePolicy,
      capLocks: [{
        capId: 'dry-run-cap',
        absoluteCap: { maxAmount: 50000000000000000n, token: 'ETH' },
      }],
    }
    const capProvider = createMemoryCapLockProvider([{
      capId: 'dry-run-cap',
      absoluteCap: { maxAmount: 50000000000000000n, token: 'ETH' },
    }])
    // Exhaust the cap
    await capProvider.acquire('dry-run-cap', 50000000000000000n, 'ETH')
    const result = await runDryRun(
      smallTransfer, capPolicy, {}, {}, capProvider,
    )
    expect(result.capLockAvailable).toBe(false)
    expect(result.blockers.some(b => b.kind === 'cap_lock_unavailable')).toBe(true)
  })

  it('does not consume cap budget on successful check', async () => {
    const capPolicy: Policy = {
      ...basePolicy,
      capLocks: [{
        capId: 'dry-run-cap-2',
        absoluteCap: { maxAmount: 1000000000000000000n, token: 'ETH' },
      }],
    }
    const capProvider = createMemoryCapLockProvider([{
      capId: 'dry-run-cap-2',
      absoluteCap: { maxAmount: 1000000000000000000n, token: 'ETH' },
    }])
    await runDryRun(smallTransfer, capPolicy, {}, {}, capProvider)
    // After dry run, cap should still be fully available
    const inspection = await capProvider.inspect('dry-run-cap-2')
    expect(inspection.absoluteCap?.totalPending).toBe(0n)
    expect(inspection.absoluteCap?.remaining).toBe(1000000000000000000n)
  })

  it('includes dryRunAt timestamp', async () => {
    const result = await runDryRun(smallTransfer, basePolicy, {}, {})
    expect(result.dryRunAt).toBeGreaterThan(0)
    expect(result.dryRunAt).toBeLessThanOrEqual(Date.now())
  })
})
