import { describe, it, expect, vi } from 'vitest'
import { executeIntent } from './execute.js'
import type { Intent, IntentStep } from './types.js'
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

const makeStep = (id: string, amount: bigint): IntentStep => ({
  id,
  action: {
    kind: 'transfer' as const,
    chain: 'ethereum' as const,
    token: { token: 'USDC', amount, decimals: 6 },
    to: '0x0000000000000000000000000000000000000001',
  },
})

const makeReceipt = (): SuccessReceipt => ({
  status: 'success',
  action: {
    kind: 'transfer', chain: 'ethereum',
    token: { token: 'USDC', amount: 1000n, decimals: 6 },
    to: '0x0000000000000000000000000000000000000001',
  },
  policyEvaluation: { passed: true, checksRun: [] },
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

describe('executeIntent — audit log integration', () => {
  it('passes intentId and intentStepId to audit log', async () => {
    const mockAuditLog = { record: vi.fn().mockResolvedValue(undefined) }
    const executor = vi.fn().mockResolvedValue(makeReceipt())
    const intent: Intent = {
      id: 'audit-test-intent',
      steps: [makeStep('step-A', 1000n)],
    }
    await executeIntent(intent, txPolicy, {
      adapters: {},
      rpcUrls: { ethereum: 'http://mock' },
      executor,
      auditLog: mockAuditLog,
    })
    expect(mockAuditLog.record).toHaveBeenCalled()
    const auditEntry = mockAuditLog.record.mock.calls[0]?.[0]
    expect(auditEntry?.intentId).toBe('audit-test-intent')
    expect(auditEntry?.intentStepId).toBe('step-A')
  })

  it('records separate audit entries per step', async () => {
    const mockAuditLog = { record: vi.fn().mockResolvedValue(undefined) }
    const executor = vi.fn().mockResolvedValue(makeReceipt())
    const intent: Intent = {
      id: 'multi-step-audit',
      steps: [makeStep('step-1', 500n), makeStep('step-2', 500n)],
    }
    await executeIntent(intent, txPolicy, {
      adapters: {},
      rpcUrls: { ethereum: 'http://mock' },
      executor,
      auditLog: mockAuditLog,
    })
    expect(mockAuditLog.record).toHaveBeenCalledTimes(2)
    const stepIds = mockAuditLog.record.mock.calls.map(
      (call: unknown[]) => (call[0] as { intentStepId?: string })?.intentStepId,
    )
    expect(stepIds).toContain('step-1')
    expect(stepIds).toContain('step-2')
  })

  it('includes intentEvaluation in the result', async () => {
    const executor = vi.fn().mockResolvedValue(makeReceipt())
    const intent: Intent = {
      id: 'eval-result-test',
      steps: [makeStep('A', 1000n)],
    }
    const result = await executeIntent(intent, txPolicy, {
      adapters: {},
      rpcUrls: { ethereum: 'http://mock' },
      executor,
    })
    expect(result.intentEvaluation).toBeDefined()
    expect(result.intentEvaluation.passed).toBe(true)
    expect(result.intentEvaluation.executionPlan).toContain('A')
  })
})
