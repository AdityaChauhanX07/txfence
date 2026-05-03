import { describe, it, expect } from 'vitest'
import type { Policy } from '../types/policy.js'
import type { SwapAction, TransferAction, ContractCallAction, BoundAction } from '../types/action.js'
import type { SimulationResult } from '../types/simulation.js'
import {
  checkChain,
  checkContract,
  checkSpend,
  checkSlippage,
  checkSimulationRequired,
  checkGasBuffer,
} from './checks.js'
import { evaluate } from './evaluate.js'

// ── fixtures ────────────────────────────────────────────────────────────────

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

const passingSim: SimulationResult = {
  success: true,
  chain: 'ethereum',
  simulatedAtBlock: 1000,
  gasEstimate: 100000n,
  gasBufferApplied: 1.3,
  coverageLevel: 'partial',
  caveats: ['state_may_diverge'],
}

function bound(
  action: SwapAction | TransferAction | ContractCallAction,
  policy: Policy = basePolicy,
): BoundAction {
  return { action, policy }
}

const ALL_CHECK_NAMES = [
  'checkChain',
  'checkContract',
  'checkSpend',
  'checkSlippage',
  'checkSimulationRequired',
  'checkGasBuffer',
]

// ── checkChain ───────────────────────────────────────────────────────────────

describe('checkChain', () => {
  it('passes when action chain is in policy chains', () => {
    const result = checkChain(bound(baseSwap))
    expect(result.passed).toBe(true)
    expect(result.name).toBe('checkChain')
  })

  it('fails with chain_not_allowed when action chain is not in policy chains', () => {
    const action: SwapAction = { ...baseSwap, chain: 'optimism' }
    const result = checkChain(bound(action))
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('chain_not_allowed')
  })
})

// ── checkContract ────────────────────────────────────────────────────────────

describe('checkContract', () => {
  it('passes when contract address is in allowedContracts for the correct chain', () => {
    const result = checkContract(bound(baseSwap))
    expect(result.passed).toBe(true)
  })

  it('fails with contract_not_allowed when address is not in allowedContracts', () => {
    const action: SwapAction = { ...baseSwap, via: '0xUNKNOWN' }
    const result = checkContract(bound(action))
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('contract_not_allowed')
  })

  it('fails with contract_not_allowed when address is in allowedContracts but for wrong chain', () => {
    // 0xUNISWAP is registered for ethereum only; using it on solana should fail
    const action: SwapAction = { ...baseSwap, chain: 'solana' }
    const result = checkContract(bound(action))
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('contract_not_allowed')
  })

  it('passes for TransferAction (no contract to check)', () => {
    const result = checkContract(bound(baseTransfer))
    expect(result.passed).toBe(true)
  })
})

// ── checkSpend ───────────────────────────────────────────────────────────────

describe('checkSpend', () => {
  it('passes when spend is below the cap', () => {
    const result = checkSpend(bound(baseSwap)) // from: 100n, cap: 500n
    expect(result.passed).toBe(true)
  })

  it('passes when spend equals the cap exactly', () => {
    const action: SwapAction = {
      ...baseSwap,
      from: { token: 'USDC', amount: 500n, decimals: 6 },
    }
    const result = checkSpend(bound(action))
    expect(result.passed).toBe(true)
  })

  it('fails with spend_exceeds_cap when spend exceeds the cap', () => {
    const action: SwapAction = {
      ...baseSwap,
      from: { token: 'USDC', amount: 501n, decimals: 6 },
    }
    const result = checkSpend(bound(action))
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('spend_exceeds_cap')
  })

  it('passes for ContractCallAction with no value', () => {
    const result = checkSpend(bound(baseContractCall))
    expect(result.passed).toBe(true)
  })

  it('passes for SwapAction when from amount is within cap', () => {
    const action: SwapAction = {
      ...baseSwap,
      from: { token: 'USDC', amount: 250n, decimals: 6 },
    }
    const result = checkSpend(bound(action))
    expect(result.passed).toBe(true)
  })
})

// ── checkSlippage ────────────────────────────────────────────────────────────

describe('checkSlippage', () => {
  it('passes for SwapAction with maxSlippage greater than 0', () => {
    const result = checkSlippage(bound(baseSwap)) // maxSlippage: 50
    expect(result.passed).toBe(true)
  })

  it('fails for SwapAction with maxSlippage of 0', () => {
    const action: SwapAction = { ...baseSwap, maxSlippage: 0 }
    const result = checkSlippage(bound(action))
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('slippage_not_declared')
  })

  it('passes for TransferAction (slippage check skipped)', () => {
    const result = checkSlippage(bound(baseTransfer))
    expect(result.passed).toBe(true)
  })

  it('passes for ContractCallAction (slippage check skipped)', () => {
    const result = checkSlippage(bound(baseContractCall))
    expect(result.passed).toBe(true)
  })
})

// ── checkSimulationRequired ──────────────────────────────────────────────────

describe('checkSimulationRequired', () => {
  it('passes when requireSimulation is false and no simulation provided', () => {
    const result = checkSimulationRequired(bound(baseSwap))
    expect(result.passed).toBe(true)
  })

  it('passes when requireSimulation is true and a passing simulation is provided', () => {
    const policy: Policy = { ...basePolicy, requireSimulation: true }
    const result = checkSimulationRequired(bound(baseSwap, policy), passingSim)
    expect(result.passed).toBe(true)
  })

  it('fails with simulation_required_but_failed when requireSimulation is true and no simulation provided', () => {
    const policy: Policy = { ...basePolicy, requireSimulation: true }
    const result = checkSimulationRequired(bound(baseSwap, policy))
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('simulation_required_but_failed')
  })

  it('fails with simulation_required_but_failed when simulation success is false', () => {
    const policy: Policy = { ...basePolicy, requireSimulation: true }
    const failedSim: SimulationResult = { ...passingSim, success: false }
    const result = checkSimulationRequired(bound(baseSwap, policy), failedSim)
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('simulation_required_but_failed')
  })
})

// ── checkGasBuffer ───────────────────────────────────────────────────────────

describe('checkGasBuffer', () => {
  it('passes when no simulation is provided (check skipped)', () => {
    const result = checkGasBuffer(bound(baseSwap))
    expect(result.passed).toBe(true)
  })

  it('passes when gasBufferApplied meets the policy multiplier exactly', () => {
    const sim: SimulationResult = { ...passingSim, gasBufferApplied: 1.2 }
    const result = checkGasBuffer(bound(baseSwap), sim) // policy multiplier: 1.2
    expect(result.passed).toBe(true)
  })

  it('passes when gasBufferApplied exceeds the policy multiplier', () => {
    const result = checkGasBuffer(bound(baseSwap), passingSim) // 1.3 >= 1.2
    expect(result.passed).toBe(true)
  })

  it('fails when gasBufferApplied is below the policy multiplier', () => {
    const sim: SimulationResult = { ...passingSim, gasBufferApplied: 1.0 }
    const result = checkGasBuffer(bound(baseSwap), sim) // 1.0 < 1.2
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('gas_buffer_insufficient')
  })
})

// ── evaluate ─────────────────────────────────────────────────────────────────

describe('evaluate', () => {
  it('returns passed: true when all checks pass', () => {
    const result = evaluate(bound(baseSwap))
    expect(result.passed).toBe(true)
    expect(result.rejectionReason).toBeUndefined()
  })

  it('returns passed: false when chain check fails, with correct rejectionReason', () => {
    const action: SwapAction = { ...baseSwap, chain: 'optimism' }
    const result = evaluate(bound(action))
    expect(result.passed).toBe(false)
    expect(result.rejectionReason).toBe('chain_not_allowed')
  })

  it('returns passed: false when contract check fails', () => {
    const action: SwapAction = { ...baseSwap, via: '0xUNKNOWN' }
    const result = evaluate(bound(action))
    expect(result.passed).toBe(false)
    expect(result.rejectionReason).toBe('contract_not_allowed')
  })

  it('returns passed: false when spend check fails', () => {
    const action: SwapAction = {
      ...baseSwap,
      from: { token: 'USDC', amount: 9999n, decimals: 6 },
    }
    const result = evaluate(bound(action))
    expect(result.passed).toBe(false)
    expect(result.rejectionReason).toBe('spend_exceeds_cap')
  })

  it('collects all check names in checksRun', () => {
    const result = evaluate(bound(baseSwap))
    expect(result.checksRun).toEqual(ALL_CHECK_NAMES)
  })

  it('continues running all checks after first failure so checksRun contains all check names', () => {
    // chain check fails immediately, but all remaining checks must still run
    const action: SwapAction = { ...baseSwap, chain: 'optimism' }
    const result = evaluate(bound(action))
    expect(result.passed).toBe(false)
    expect(result.checksRun).toEqual(ALL_CHECK_NAMES)
  })
})
