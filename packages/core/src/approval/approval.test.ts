import { describe, it, expect } from 'vitest'
import { createMemoryApprovalProvider } from './memory.js'
import { runPipeline } from '../agent/pipeline.js'
import type { Policy } from '../types/policy.js'
import type { TransferAction } from '../types/action.js'

// ── fixtures ─────────────────────────────────────────────────────────────────

const approvalPolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'USDC', amount: 10000n, decimals: 6 },
  allowedContracts: [],
  requireSimulation: false,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 500n, decimals: 6 },
  humanApprovalTimeoutMs: 100,
  capLockMode: 'per-agent',
}

const bigTransfer: TransferAction = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'USDC', amount: 1000n, decimals: 6 },
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}

// ── createMemoryApprovalProvider ─────────────────────────────────────────────

describe('createMemoryApprovalProvider', () => {
  it('starts with no pending requests', () => {
    const provider = createMemoryApprovalProvider()
    expect(provider.pending()).toHaveLength(0)
  })

  it('records a request via request()', async () => {
    const provider = createMemoryApprovalProvider()
    await provider.request({
      token: 'abc',
      action: bigTransfer,
      simulation: { gasEstimate: '21000', coverageLevel: 'partial', caveats: [] },
      policyContext: {
        maxSpendPerTx: { token: 'USDC', amount: '10000' },
        humanApprovalThreshold: { token: 'USDC', amount: '500' },
      },
      requestedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      approveUrl: '',
      rejectUrl: '',
    })
    expect(provider.pending()).toHaveLength(1)
    expect(provider.pending()[0]!.token).toBe('abc')
  })

  it('returns null from poll before a decision is made', async () => {
    const provider = createMemoryApprovalProvider()
    const result = await provider.poll('unknown-token')
    expect(result).toBeNull()
  })

  it('returns the decision after decide() is called', async () => {
    const provider = createMemoryApprovalProvider()
    provider.decide('tok1', 'approved')
    const result = await provider.poll('tok1')
    expect(result).toBe('approved')
  })

  it('returns rejected decision correctly', async () => {
    const provider = createMemoryApprovalProvider()
    provider.decide('tok2', 'rejected')
    expect(await provider.poll('tok2')).toBe('rejected')
  })
})

// ── runPipeline with approval provider ───────────────────────────────────────

describe('runPipeline with approval provider', () => {
  it('returns approval_timeout when no provider is configured and spend exceeds threshold', async () => {
    const result = await runPipeline(bigTransfer, approvalPolicy, {}, {})
    expect(result.status).toBe('approval_timeout')
  })

  it('dispatches an approval request when provider is configured and spend exceeds threshold', async () => {
    const provider = createMemoryApprovalProvider()
    setTimeout(() => provider.decide(provider.pending()[0]!.token, 'approved'), 20)
    const result = await runPipeline(
      bigTransfer, approvalPolicy, {}, {}, undefined, undefined, undefined, provider,
    )
    expect(provider.pending()).toHaveLength(1)
    expect(result.status).toBe('execution_failed')
  })

  it('proceeds past approval when decision is approved', async () => {
    const provider = createMemoryApprovalProvider()
    setTimeout(() => provider.decide(provider.pending()[0]!.token, 'approved'), 20)
    const result = await runPipeline(
      bigTransfer, approvalPolicy, {}, {}, undefined, undefined, undefined, provider,
    )
    expect(result.status).not.toBe('approval_timeout')
  })

  it('returns approval_timeout when decision is rejected', async () => {
    const provider = createMemoryApprovalProvider()
    setTimeout(() => provider.decide(provider.pending()[0]!.token, 'rejected'), 20)
    const result = await runPipeline(
      bigTransfer, approvalPolicy, {}, {}, undefined, undefined, undefined, provider,
    )
    expect(result.status).toBe('approval_timeout')
  })

  it('returns approval_timeout when timeout expires with no decision', async () => {
    const provider = createMemoryApprovalProvider()
    const result = await runPipeline(
      bigTransfer, approvalPolicy, {}, {}, undefined, undefined, undefined, provider,
    )
    expect(result.status).toBe('approval_timeout')
  })
})
