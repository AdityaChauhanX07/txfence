import type { BoundAction } from '../types/action.js'
import type { SimulationResult } from '../types/simulation.js'
import type { PolicyRejectionReason } from '../types/receipt.js'

export type CheckResult = {
  name: string
  passed: boolean
  reason?: PolicyRejectionReason
}

export function checkChain(action: BoundAction): CheckResult {
  const passed = action.policy.chains.includes(action.action.chain)
  if (!passed) return { name: 'checkChain', passed: false, reason: 'chain_not_allowed' }
  return { name: 'checkChain', passed: true }
}

export function checkContract(action: BoundAction): CheckResult {
  const { action: act, policy } = action

  if (act.kind === 'transfer') {
    return { name: 'checkContract', passed: true }
  }

  const contractAddress = act.kind === 'swap' ? act.via : act.contract
  const chain = act.chain

  const entry = policy.allowedContracts.find(
    e => e.address === contractAddress && e.chain === chain,
  )

  if (entry === undefined) {
    return { name: 'checkContract', passed: false, reason: 'contract_not_allowed' }
  }

  // metadata verification: requires chain call, implemented in adapter layer

  return { name: 'checkContract', passed: true }
}

export function checkSpend(action: BoundAction): CheckResult {
  const { action: act, policy } = action
  const cap = policy.maxSpendPerTx

  let spend =
    act.kind === 'swap' ? act.from
    : act.kind === 'transfer' ? act.token
    : act.value

  if (spend === undefined || spend.token !== cap.token) {
    return { name: 'checkSpend', passed: true }
  }

  if (spend.amount > cap.amount) {
    return { name: 'checkSpend', passed: false, reason: 'spend_exceeds_cap' }
  }
  return { name: 'checkSpend', passed: true }
}

export function checkSlippage(action: BoundAction): CheckResult {
  if (action.action.kind !== 'swap') {
    return { name: 'checkSlippage', passed: true }
  }

  const passed = action.action.maxSlippage > 0
  return { name: 'checkSlippage', passed }
}

// cap lock check: requires external lock provider, implemented in agent layer

export function checkSimulationRequired(
  action: BoundAction,
  simulationResult?: SimulationResult,
): CheckResult {
  if (action.policy.requireSimulation && simulationResult === undefined) {
    return {
      name: 'checkSimulationRequired',
      passed: false,
      reason: 'simulation_required_but_failed',
    }
  }

  if (simulationResult !== undefined && !simulationResult.success) {
    return {
      name: 'checkSimulationRequired',
      passed: false,
      reason: 'simulation_required_but_failed',
    }
  }

  return { name: 'checkSimulationRequired', passed: true }
}

export function checkGasBuffer(
  action: BoundAction,
  simulationResult?: SimulationResult,
): CheckResult {
  if (simulationResult === undefined) {
    return { name: 'checkGasBuffer', passed: true }
  }

  const passed = simulationResult.gasBufferApplied >= action.policy.gasBufferMultiplier
  return { name: 'checkGasBuffer', passed }
}
