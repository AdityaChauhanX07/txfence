import { describe, it, expect } from 'vitest'
import type { ApprovalProvider, ApprovalRequest } from '../approval/types.js'

function makeApprovalRequest(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    token: 'test-token-abc',
    action: {
      kind: 'transfer',
      chain: 'ethereum',
      token: { token: 'USDC', amount: 1000n, decimals: 6 },
      to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    },
    simulation: { gasEstimate: '21000', coverageLevel: 'basic', caveats: [] },
    policyContext: {
      maxSpendPerTx: { token: 'USDC', amount: '10000' },
      humanApprovalThreshold: { token: 'USDC', amount: '500' },
    },
    requestedAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    approveUrl: '',
    rejectUrl: '',
    ...overrides,
  }
}

export function approvalProviderContract(
  name: string,
  createProvider: () => ApprovalProvider,
): void {
  describe(name, () => {
    it('request() resolves without throwing', async () => {
      const provider = createProvider()
      await expect(provider.request(makeApprovalRequest())).resolves.toBeUndefined()
    })

    it('poll() returns null for an unknown token', async () => {
      const provider = createProvider()
      expect(await provider.poll('nonexistent-token')).toBeNull()
    })
  })
}
