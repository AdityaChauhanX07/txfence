import { describe, it, expect } from 'vitest'
import type { Policy } from '../types/policy.js'
import type { SwapAction, TransferAction, ContractCallAction, BoundAction } from '../types/action.js'
import type { SimulationResult } from '../types/simulation.js'
import { getPolicyRejectionMessage, getSimulationFailureMessage } from './messages.js'

// ── fixtures ─────────────────────────────────────────────────────────────────

const basePolicy: Policy = {
  chains: ['ethereum', 'solana'],
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

// ── getPolicyRejectionMessage ─────────────────────────────────────────────────

describe('getPolicyRejectionMessage', () => {
  it('returns the correct message for chain_not_allowed', () => {
    const msg = getPolicyRejectionMessage('chain_not_allowed', bound(baseSwap))
    expect(msg).toContain('ethereum')
    expect(msg).toContain('solana')
  })

  it('returns the correct message for contract_not_allowed on a SwapAction', () => {
    const msg = getPolicyRejectionMessage('contract_not_allowed', bound(baseSwap))
    expect(msg).toContain('0xUNISWAP')
    expect(msg).toContain('ethereum')
  })

  it('returns the correct message for spend_exceeds_cap on a SwapAction including the amounts', () => {
    const msg = getPolicyRejectionMessage('spend_exceeds_cap', bound(baseSwap))
    expect(msg).toContain('100')
    expect(msg).toContain('500')
    expect(msg).toContain('USDC')
  })

  it('returns the correct message for slippage_not_declared', () => {
    const msg = getPolicyRejectionMessage('slippage_not_declared', bound(baseSwap))
    expect(msg).toContain('slippage')
    expect(msg).toContain('maxSlippage')
  })

  it('returns the correct message for cap_lock_unavailable', () => {
    const msg = getPolicyRejectionMessage('cap_lock_unavailable', bound(baseSwap))
    expect(msg).toContain('cap')
  })

  it('returns the correct message for bytecode_hash_mismatch on a SwapAction', () => {
    const msg = getPolicyRejectionMessage('bytecode_hash_mismatch', bound(baseSwap))
    expect(msg).toContain('0xUNISWAP')
    expect(msg).toContain('bytecode')
  })

  it('returns the correct message for contract_entry_expired on a ContractCallAction', () => {
    const msg = getPolicyRejectionMessage('contract_entry_expired', bound(baseContractCall))
    expect(msg).toContain('0xUNISWAP')
    expect(msg).toContain('expired')
  })
})

// ── getSimulationFailureMessage ───────────────────────────────────────────────

describe('getSimulationFailureMessage', () => {
  const sim: SimulationResult = {
    success: false,
    chain: 'ethereum',
    simulatedAtBlock: 1234,
    gasEstimate: 0n,
    gasBufferApplied: 1,
    coverageLevel: 'partial',
    caveats: ['state_may_diverge'],
  }

  it('returns a message including the chain, block, coverage level, and caveats', () => {
    const msg = getSimulationFailureMessage(sim)
    expect(msg).toContain('ethereum')
    expect(msg).toContain('1234')
    expect(msg).toContain('partial')
    expect(msg).toContain('state_may_diverge')
  })

  it('handles empty caveats with none', () => {
    const msg = getSimulationFailureMessage({ ...sim, caveats: [] })
    expect(msg).toContain('none')
  })
})
