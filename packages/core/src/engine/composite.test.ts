import { describe, it, expect } from 'vitest'
import { evaluateNode, policyLeaf, policyAnd, policyOr } from './composite.js'
import type { Policy } from '../types/policy.js'
import type { TransferAction } from '../types/action.js'

// basePolicy uses a 10_000n cap so it passes for largeTransfer (2_000n).
// strictPolicy (100n) fails for largeTransfer; looserPolicy (5_000n) passes.
const basePolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'USDC', amount: 10_000n, decimals: 6 },
  allowedContracts: [{ address: '0xUNISWAP', chain: 'ethereum' }],
  requireSimulation: false,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent',
}

const strictPolicy: Policy = {
  ...basePolicy,
  maxSpendPerTx: { token: 'USDC', amount: 100n, decimals: 6 },
}

const looserPolicy: Policy = {
  ...basePolicy,
  maxSpendPerTx: { token: 'USDC', amount: 5000n, decimals: 6 },
}

const smallTransfer: TransferAction = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'USDC', amount: 500n, decimals: 6 },
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}

const largeTransfer: TransferAction = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'USDC', amount: 2000n, decimals: 6 },
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}

// ── policyLeaf ────────────────────────────────────────────────────────────────

describe('policyLeaf', () => {
  it('passes when the leaf policy passes', () => {
    const node = policyLeaf(basePolicy)
    const result = evaluateNode(node, smallTransfer)
    expect(result.passed).toBe(true)
    expect(result.nodeKind).toBe('leaf')
    expect(result.leaf).toBeDefined()
    expect(result.firstRejectionReason).toBeUndefined()
  })

  it('fails when the leaf policy fails', () => {
    const node = policyLeaf(strictPolicy)
    const result = evaluateNode(node, largeTransfer)
    expect(result.passed).toBe(false)
    expect(result.firstRejectionReason).toBe('spend_exceeds_cap')
  })

  it('carries label through to result', () => {
    const node = policyLeaf(basePolicy, 'base-check')
    const result = evaluateNode(node, smallTransfer)
    expect(result.label).toBe('base-check')
  })
})

// ── policyAnd ─────────────────────────────────────────────────────────────────

describe('policyAnd', () => {
  it('passes when all children pass', () => {
    const node = policyAnd([
      policyLeaf(basePolicy, 'check-A'),
      policyLeaf(looserPolicy, 'check-B'),
    ])
    const result = evaluateNode(node, smallTransfer)
    expect(result.passed).toBe(true)
    expect(result.children).toHaveLength(2)
    expect(result.children?.every(c => c.passed)).toBe(true)
  })

  it('fails when any child fails', () => {
    const node = policyAnd([
      policyLeaf(basePolicy, 'check-A'),
      policyLeaf(strictPolicy, 'check-B'),
    ])
    const result = evaluateNode(node, largeTransfer)
    expect(result.passed).toBe(false)
    expect(result.firstRejectionReason).toBe('spend_exceeds_cap')
  })

  it('reports which child failed', () => {
    const node = policyAnd([
      policyLeaf(looserPolicy, 'loose'),
      policyLeaf(strictPolicy, 'strict'),
    ])
    const result = evaluateNode(node, largeTransfer)
    expect(result.passed).toBe(false)
    const failedChild = result.children?.find(c => !c.passed)
    expect(failedChild?.label).toBe('strict')
  })

  it('passes with empty children (vacuous truth)', () => {
    const node = policyAnd([])
    const result = evaluateNode(node, smallTransfer)
    expect(result.passed).toBe(true)
  })
})

// ── policyOr ──────────────────────────────────────────────────────────────────

describe('policyOr', () => {
  it('passes when any child passes', () => {
    const node = policyOr([
      policyLeaf(strictPolicy, 'strict'),
      policyLeaf(basePolicy, 'base'),
    ])
    const result = evaluateNode(node, largeTransfer)
    expect(result.passed).toBe(true)
  })

  it('fails when all children fail', () => {
    const node = policyOr([
      policyLeaf(strictPolicy, 'strict-A'),
      policyLeaf(strictPolicy, 'strict-B'),
    ])
    const result = evaluateNode(node, largeTransfer)
    expect(result.passed).toBe(false)
    expect(result.firstRejectionReason).toBeDefined()
  })

  it('passes with first passing child even if others fail', () => {
    const node = policyOr([
      policyLeaf(basePolicy, 'base'),
      policyLeaf(strictPolicy, 'strict'),
    ])
    const result = evaluateNode(node, smallTransfer)
    expect(result.passed).toBe(true)
  })

  it('fails with empty children (vacuous false)', () => {
    const node = policyOr([])
    const result = evaluateNode(node, smallTransfer)
    expect(result.passed).toBe(false)
  })
})

// ── nested composite policies ─────────────────────────────────────────────────

describe('nested composite policies', () => {
  it('evaluates AND of ORs correctly', () => {
    // (strict OR loose) AND (base) — largeTransfer: strict fails, loose passes → OR passes; base passes → AND passes
    const node = policyAnd([
      policyOr([policyLeaf(strictPolicy), policyLeaf(looserPolicy)], 'spend-tier'),
      policyLeaf(basePolicy, 'chain-check'),
    ], 'treasury-policy')
    const result = evaluateNode(node, largeTransfer)
    expect(result.passed).toBe(true)
    expect(result.label).toBe('treasury-policy')
  })

  it('evaluates OR of ANDs correctly', () => {
    // (strict AND base) OR (loose AND base)
    // largeTransfer: strict AND base → strict fails → AND fails
    // largeTransfer: loose AND base → both pass → AND passes → OR passes
    const node = policyOr([
      policyAnd([policyLeaf(strictPolicy), policyLeaf(basePolicy)], 'strict-path'),
      policyAnd([policyLeaf(looserPolicy), policyLeaf(basePolicy)], 'loose-path'),
    ], 'composite')
    const result = evaluateNode(node, largeTransfer)
    expect(result.passed).toBe(true)
    const passedPath = result.children?.find(c => c.passed)
    expect(passedPath?.label).toBe('loose-path')
  })

  it('propagates firstRejectionReason from deeply nested failure', () => {
    const node = policyAnd([
      policyOr([
        policyLeaf(strictPolicy),
        policyLeaf(strictPolicy),
      ]),
      policyLeaf(basePolicy),
    ])
    const result = evaluateNode(node, largeTransfer)
    expect(result.passed).toBe(false)
    expect(result.firstRejectionReason).toBe('spend_exceeds_cap')
  })
})
