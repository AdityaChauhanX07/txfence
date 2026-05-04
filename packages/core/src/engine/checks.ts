import type { BoundAction } from '../types/action.js'
import type { SimulationResult } from '../types/simulation.js'
import type { PolicyRejectionReason } from '../types/receipt.js'
import type { CapLockProvider } from '../caps/provider.js'
import type { MetadataVerifier } from '../verification/provider.js'

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

  return { name: 'checkContract', passed: true }
}

export async function checkMetadata(
  action: BoundAction,
  verifier?: MetadataVerifier,
): Promise<CheckResult> {
  const { action: act, policy } = action

  if (act.kind === 'transfer') {
    return { name: 'checkMetadata', passed: true }
  }

  const contractAddress = act.kind === 'swap' ? act.via : act.contract
  const chain = act.chain

  const entry = policy.allowedContracts.find(
    e => e.address === contractAddress && e.chain === chain,
  )

  if (entry === undefined) {
    return { name: 'checkMetadata', passed: true }
  }

  if (entry.expiresAt !== undefined && entry.expiresAt < Date.now()) {
    return { name: 'checkMetadata', passed: false, reason: 'contract_entry_expired' }
  }

  // no verifier configured — bytecode and owner checks skipped
  if (verifier === undefined) {
    return { name: 'checkMetadata', passed: true }
  }

  // no metadata pinned on this entry — nothing to verify
  if (entry.bytecodeHash === undefined && entry.ownerAddress === undefined) {
    return { name: 'checkMetadata', passed: true }
  }

  const result = await verifier.verifyContract(entry)
  if (!result.verified) {
    return { name: 'checkMetadata', passed: false, reason: result.reason }
  }

  return { name: 'checkMetadata', passed: true }
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

  if (action.action.maxSlippage <= 0) {
    return { name: 'checkSlippage', passed: false, reason: 'slippage_not_declared' }
  }
  return { name: 'checkSlippage', passed: true }
}

export async function checkCapLock(
  action: BoundAction,
  provider?: CapLockProvider,
): Promise<CheckResult & { lockId?: string }> {
  const { policy, action: act } = action

  if (policy.capLocks === undefined || policy.capLocks.length === 0) {
    return { name: 'checkCapLock', passed: true }
  }

  // no provider configured — cap lock check skipped. configure a CapLockProvider for multi-agent environments.
  if (provider === undefined) {
    return { name: 'checkCapLock', passed: true }
  }

  let spendAmount: bigint
  let spendToken: string

  if (act.kind === 'swap') {
    spendAmount = act.from.amount
    spendToken = act.from.token
  } else if (act.kind === 'transfer') {
    spendAmount = act.token.amount
    spendToken = act.token.token
  } else if (act.value !== undefined) {
    spendAmount = act.value.amount
    spendToken = act.value.token
  } else {
    return { name: 'checkCapLock', passed: true }
  }

  // Note: in a full implementation, multiple cap IDs would each return their own lockId.
  // For now track the last granted lockId.
  let lastGrantedLockId: string | undefined = undefined

  for (const capLock of policy.capLocks) {
    const result = await provider.acquire(capLock.capId, spendAmount, spendToken)
    if (!result.granted) {
      return { name: 'checkCapLock', passed: false, reason: 'cap_lock_unavailable' }
    }
    lastGrantedLockId = result.lockId
  }

  if (lastGrantedLockId !== undefined) {
    return { name: 'checkCapLock', passed: true, lockId: lastGrantedLockId }
  }
  return { name: 'checkCapLock', passed: true }
}

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

  if (simulationResult.gasBufferApplied < action.policy.gasBufferMultiplier) {
    return { name: 'checkGasBuffer', passed: false, reason: 'gas_buffer_insufficient' }
  }
  return { name: 'checkGasBuffer', passed: true }
}
