import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { evaluate } from './evaluate.js'
import type { Policy, ChainId, TokenAmount, ContractEntry } from '../types/policy.js'
import type { BoundAction, SwapAction, TransferAction } from '../types/action.js'
import type { SimulationResult } from '../types/simulation.js'

// ── Arbitraries ──────────────────────────────────────────────────────────────

const chainIdArb: fc.Arbitrary<ChainId> =
  fc.constantFrom('ethereum', 'arbitrum', 'optimism', 'base', 'solana', 'cosmoshub', 'osmosis')

const evmChainIdArb: fc.Arbitrary<ChainId> =
  fc.constantFrom('ethereum', 'arbitrum', 'optimism', 'base')

const tokenArb: fc.Arbitrary<string> =
  fc.constantFrom('ETH', 'USDC', 'USDT', 'DAI', 'WBTC')

const tokenAmountArb: fc.Arbitrary<TokenAmount> =
  fc.record({
    token: tokenArb,
    amount: fc.bigInt({ min: 0n, max: 10_000_000_000_000_000_000n }),
    decimals: fc.constantFrom(6, 8, 18),
  })

const hexChar = fc.constantFrom(
  '0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f',
)

const addressArb: fc.Arbitrary<string> =
  fc.array(hexChar, { minLength: 40, maxLength: 40 }).map(chars => '0x' + chars.join(''))

const contractEntryArb: fc.Arbitrary<ContractEntry> =
  fc.record({
    address: addressArb,
    chain: chainIdArb,
  })

const policyArb: fc.Arbitrary<Policy> =
  fc.record({
    chains: fc.uniqueArray(chainIdArb, { minLength: 1, maxLength: 4 }),
    maxSpendPerTx: tokenAmountArb,
    allowedContracts: fc.array(contractEntryArb, { minLength: 0, maxLength: 5 }),
    requireSimulation: fc.boolean(),
    gasBufferMultiplier: fc.float({ min: 1.0, max: 3.0, noNaN: true }),
    humanApprovalThreshold: tokenAmountArb,
    humanApprovalTimeoutMs: fc.integer({ min: 1000, max: 300000 }),
    capLockMode: fc.constantFrom('per-agent', 'shared'),
  })

const transferActionArb = (chain: ChainId): fc.Arbitrary<TransferAction> =>
  fc.record({
    kind: fc.constant('transfer' as const),
    chain: fc.constant(chain),
    token: tokenAmountArb,
    to: addressArb,
  })

const swapActionArb = (chain: ChainId, allowedAddresses: string[]): fc.Arbitrary<SwapAction> =>
  fc.record({
    kind: fc.constant('swap' as const),
    chain: fc.constant(chain),
    from: tokenAmountArb,
    to: tokenArb,
    via: allowedAddresses.length > 0
      ? fc.constantFrom(...allowedAddresses)
      : addressArb,
    maxSlippage: fc.integer({ min: 0, max: 10000 }),
  })

const passingSimulationArb: fc.Arbitrary<SimulationResult> =
  fc.record({
    success: fc.constant(true),
    wouldRevert: fc.constant(false),
    chain: chainIdArb,
    simulatedAtBlock: fc.integer({ min: 1, max: 30000000 }),
    gasEstimate: fc.bigInt({ min: 21000n, max: 10000000n }),
    gasBufferApplied: fc.float({ min: 1.0, max: 3.0, noNaN: true }),
    coverageLevel: fc.constantFrom('basic' as const, 'deep' as const, 'partial' as const),
    caveats: fc.array(fc.constantFrom(
      'state_may_diverge' as const,
      'proxy_implementation_unverified' as const,
    )),
    provider: fc.constantFrom('eth_call' as const, 'tenderly' as const),
  })

// ── Property tests ───────────────────────────────────────────────────────────

describe('policy engine — property-based tests', () => {
  it('evaluate returns the same result for the same inputs', () => {
    fc.assert(fc.property(
      policyArb.chain(policy => {
        const chain = policy.chains[0] ?? 'ethereum'
        return transferActionArb(chain).map(action => ({ action, policy }))
      }),
      ({ action, policy }) => {
        const boundAction: BoundAction = { action, policy }
        const result1 = evaluate(boundAction)
        const result2 = evaluate(boundAction)
        expect(result1.passed).toBe(result2.passed)
        expect(result1.rejectionReason).toBe(result2.rejectionReason)
        expect(result1.checksRun).toEqual(result2.checksRun)
      }
    ), { numRuns: 100 })
  })

  it('checkChain always appears in checksRun', () => {
    fc.assert(fc.property(
      policyArb,
      policyArb.chain(policy => {
        const chain = policy.chains[0] ?? 'ethereum'
        return transferActionArb(chain)
      }),
      (policy, action) => {
        const result = evaluate({ action, policy })
        expect(result.checksRun).toContain('checkChain')
      }
    ), { numRuns: 200 })
  })

  it('action on unlisted chain always fails with chain_not_allowed', () => {
    fc.assert(fc.property(
      policyArb,
      fc.record({
        kind: fc.constant('transfer' as const),
        chain: fc.constant('solana' as ChainId),
        token: tokenAmountArb,
        to: addressArb,
      }),
      (policy, action) => {
        fc.pre(!policy.chains.includes('solana'))
        const result = evaluate({ action, policy })
        expect(result.passed).toBe(false)
        expect(result.rejectionReason).toBe('chain_not_allowed')
      }
    ), { numRuns: 200 })
  })

  it('transfer at exactly maxSpendPerTx amount passes spend check (same token)', () => {
    fc.assert(fc.property(
      policyArb,
      (policy) => {
        fc.pre(policy.chains.includes('ethereum'))
        fc.pre(policy.maxSpendPerTx.amount > 0n)
        const action: TransferAction = {
          kind: 'transfer',
          chain: 'ethereum',
          token: {
            token: policy.maxSpendPerTx.token,
            amount: policy.maxSpendPerTx.amount,
            decimals: policy.maxSpendPerTx.decimals,
          },
          to: '0x0000000000000000000000000000000000000001',
        }
        const result = evaluate({ action, policy })
        expect(result.rejectionReason).not.toBe('spend_exceeds_cap')
      }
    ), { numRuns: 200 })
  })

  it('transfer over maxSpendPerTx always fails with spend_exceeds_cap (same token)', () => {
    fc.assert(fc.property(
      policyArb,
      (policy) => {
        fc.pre(policy.chains.includes('ethereum'))
        fc.pre(policy.maxSpendPerTx.amount < BigInt(Number.MAX_SAFE_INTEGER))
        const action: TransferAction = {
          kind: 'transfer',
          chain: 'ethereum',
          token: {
            token: policy.maxSpendPerTx.token,
            amount: policy.maxSpendPerTx.amount + 1n,
            decimals: policy.maxSpendPerTx.decimals,
          },
          to: '0x0000000000000000000000000000000000000001',
        }
        const result = evaluate({ action, policy })
        expect(result.passed).toBe(false)
        expect(result.rejectionReason).toBe('spend_exceeds_cap')
      }
    ), { numRuns: 200 })
  })

  it('swap with maxSlippage === 0 always fails with slippage_not_declared', () => {
    fc.assert(fc.property(
      policyArb,
      addressArb,
      (basePolicy, via) => {
        fc.pre(basePolicy.chains.includes('ethereum'))
        // Ensure checkContract passes by including via in allowedContracts
        const policy: Policy = {
          ...basePolicy,
          allowedContracts: [
            ...basePolicy.allowedContracts,
            { address: via, chain: 'ethereum' },
          ],
        }
        const action: SwapAction = {
          kind: 'swap',
          chain: 'ethereum',
          from: {
            token: policy.maxSpendPerTx.token,
            amount: policy.maxSpendPerTx.amount / 2n,
            decimals: policy.maxSpendPerTx.decimals,
          },
          to: 'ETH',
          via,
          maxSlippage: 0,
        }
        const result = evaluate({ action, policy })
        expect(result.passed).toBe(false)
        expect(result.rejectionReason).toBe('slippage_not_declared')
      }
    ), { numRuns: 200 })
  })

  it('evaluate never throws for any valid action/policy combination', () => {
    fc.assert(fc.property(
      policyArb,
      policyArb.chain(policy => {
        const chain = policy.chains[0] ?? 'ethereum'
        return transferActionArb(chain)
      }),
      (policy, action) => {
        expect(() => evaluate({ action, policy })).not.toThrow()
      }
    ), { numRuns: 300 })
  })

  it('passed evaluation never has a rejectionReason', () => {
    fc.assert(fc.property(
      policyArb,
      policyArb.chain(policy => {
        const chain = policy.chains[0] ?? 'ethereum'
        return transferActionArb(chain)
      }),
      (policy, action) => {
        const result = evaluate({ action, policy })
        if (result.passed) {
          expect(result.rejectionReason).toBeUndefined()
        } else {
          expect(result.rejectionReason).toBeDefined()
        }
      }
    ), { numRuns: 300 })
  })
})
