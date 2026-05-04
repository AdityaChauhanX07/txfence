import { describe, it, expect } from 'vitest'
import type { Policy } from '../types/policy.js'
import type { SwapAction, TransferAction, ContractCallAction, BoundAction } from '../types/action.js'
import type { MetadataVerifier, MetadataVerificationResult } from './provider.js'
import { checkMetadata } from '../engine/checks.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function mockVerifier(result: MetadataVerificationResult): MetadataVerifier {
  return {
    verifyContract: async () => result,
  }
}

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

const policyWithMetadata: Policy = {
  ...basePolicy,
  allowedContracts: [
    { address: '0xUNISWAP', chain: 'ethereum', bytecodeHash: '0xABC123', ownerAddress: '0xOWNER' },
  ],
}

const baseSwap: SwapAction = {
  kind: 'swap',
  chain: 'ethereum',
  from: { token: 'USDC', amount: 100n, decimals: 6 },
  to: 'ETH',
  via: '0xUNISWAP',
  maxSlippage: 50,
}

const baseTransfer: TransferAction = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'USDC', amount: 100n, decimals: 6 },
  to: '0xRECIPIENT',
}

const baseContractCall: ContractCallAction = {
  kind: 'contract_call',
  chain: 'ethereum',
  contract: '0xUNISWAP',
  method: 'deposit',
  args: [],
}

function bound(
  action: SwapAction | TransferAction | ContractCallAction,
  policy: Policy = basePolicy,
): BoundAction {
  return { action, policy }
}

// ── checkMetadata — expiry ────────────────────────────────────────────────────

describe('checkMetadata — expiry', () => {
  it('rejects with contract_entry_expired when expiresAt is in the past', async () => {
    const policy: Policy = {
      ...basePolicy,
      allowedContracts: [{ address: '0xUNISWAP', chain: 'ethereum', expiresAt: Date.now() - 1000 }],
    }
    const result = await checkMetadata(bound(baseSwap, policy))
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('contract_entry_expired')
  })

  it('passes when expiresAt is in the future', async () => {
    const policy: Policy = {
      ...basePolicy,
      allowedContracts: [{ address: '0xUNISWAP', chain: 'ethereum', expiresAt: Date.now() + 60000 }],
    }
    const result = await checkMetadata(bound(baseSwap, policy))
    expect(result.passed).toBe(true)
  })

  it('passes when expiresAt is not set', async () => {
    const result = await checkMetadata(bound(baseSwap, basePolicy))
    expect(result.passed).toBe(true)
  })
})

// ── checkMetadata — no verifier ───────────────────────────────────────────────

describe('checkMetadata — no verifier', () => {
  it('passes for SwapAction when no verifier is configured', async () => {
    const result = await checkMetadata(bound(baseSwap, policyWithMetadata))
    expect(result.passed).toBe(true)
    expect(result.name).toBe('checkMetadata')
  })

  it('passes for TransferAction (no contract to check)', async () => {
    const result = await checkMetadata(bound(baseTransfer))
    expect(result.passed).toBe(true)
  })
})

// ── checkMetadata — with verifier ─────────────────────────────────────────────

describe('checkMetadata — with verifier', () => {
  it('passes when verifier returns verified: true', async () => {
    const result = await checkMetadata(
      bound(baseSwap, policyWithMetadata),
      mockVerifier({ verified: true }),
    )
    expect(result.passed).toBe(true)
  })

  it('rejects with bytecode_hash_mismatch when verifier returns that reason', async () => {
    const result = await checkMetadata(
      bound(baseSwap, policyWithMetadata),
      mockVerifier({ verified: false, reason: 'bytecode_hash_mismatch' }),
    )
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('bytecode_hash_mismatch')
  })

  it('rejects with owner_address_mismatch when verifier returns that reason', async () => {
    const result = await checkMetadata(
      bound(baseSwap, policyWithMetadata),
      mockVerifier({ verified: false, reason: 'owner_address_mismatch' }),
    )
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('owner_address_mismatch')
  })

  it('passes for TransferAction even when verifier is provided (no contract)', async () => {
    const result = await checkMetadata(
      bound(baseTransfer, policyWithMetadata),
      mockVerifier({ verified: false, reason: 'bytecode_hash_mismatch' }),
    )
    expect(result.passed).toBe(true)
  })

  it('passes when entry has no bytecodeHash or ownerAddress pinned', async () => {
    const result = await checkMetadata(
      bound(baseSwap, basePolicy),
      mockVerifier({ verified: false, reason: 'bytecode_hash_mismatch' }),
    )
    expect(result.passed).toBe(true)
  })
})
