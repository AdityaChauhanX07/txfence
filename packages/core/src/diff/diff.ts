import { evaluate } from '../engine/evaluate.js'
import type { PolicyDiffInput, PolicyDiff, ActionDiffResult, ChangedCheck, ActionDiffDirection } from './types.js'
import type { BoundAction } from '../types/action.js'
import type { PolicyRejectionReason } from '../types/receipt.js'

function getRejectionCheckName(reason: PolicyRejectionReason): string {
  switch (reason) {
    case 'chain_not_allowed': return 'checkChain'
    case 'chain_id_mismatch': return 'checkChain'
    case 'contract_not_allowed': return 'checkContract'
    case 'bytecode_hash_mismatch': return 'checkMetadata'
    case 'owner_address_mismatch': return 'checkMetadata'
    case 'contract_entry_expired': return 'checkMetadata'
    case 'spend_exceeds_cap': return 'checkSpend'
    case 'slippage_not_declared': return 'checkSlippage'
    case 'cap_lock_unavailable': return 'checkCapLock'
    case 'simulation_required_but_failed': return 'checkSimulationRequired'
    case 'gas_buffer_insufficient': return 'checkGasBuffer'
    default: return 'unknown'
  }
}

export function diffPolicies(input: PolicyDiffInput): PolicyDiff {
  const results: ActionDiffResult[] = []

  for (const { action, simulationResult } of input.actions) {
    const boundA: BoundAction = { action, policy: input.policyA }
    const boundB: BoundAction = { action, policy: input.policyB }

    const evaluationA = evaluate(boundA, simulationResult)
    const evaluationB = evaluate(boundB, simulationResult)

    const changed =
      evaluationA.passed !== evaluationB.passed ||
      evaluationA.rejectionReason !== evaluationB.rejectionReason

    let direction: ActionDiffDirection | undefined = undefined
    if (changed) {
      if (!evaluationA.passed && evaluationB.passed) {
        direction = 'newly_allowed'
      } else if (evaluationA.passed && !evaluationB.passed) {
        direction = 'newly_rejected'
      } else {
        direction = 'rejection_reason_changed'
      }
    }

    const allChecks = new Set([...evaluationA.checksRun, ...evaluationB.checksRun])
    const changedChecks: ChangedCheck[] = []

    for (const checkName of allChecks) {
      const inA = evaluationA.checksRun.includes(checkName)
      const inB = evaluationB.checksRun.includes(checkName)

      const isRejectionInA =
        !evaluationA.passed &&
        evaluationA.rejectionReason !== undefined &&
        checkName === getRejectionCheckName(evaluationA.rejectionReason)

      const isRejectionInB =
        !evaluationB.passed &&
        evaluationB.rejectionReason !== undefined &&
        checkName === getRejectionCheckName(evaluationB.rejectionReason)

      if (inA !== inB || isRejectionInA !== isRejectionInB) {
        changedChecks.push({
          checkName,
          inA,
          inB,
          ...(isRejectionInA && evaluationA.rejectionReason !== undefined
            ? { rejectionReasonA: evaluationA.rejectionReason }
            : {}),
          ...(isRejectionInB && evaluationB.rejectionReason !== undefined
            ? { rejectionReasonB: evaluationB.rejectionReason }
            : {}),
        })
      }
    }

    results.push({
      action,
      ...(simulationResult !== undefined ? { simulationResult } : {}),
      evaluationA,
      evaluationB,
      changed,
      ...(direction !== undefined ? { direction } : {}),
      changedChecks,
    })
  }

  const changedResults = results.filter(r => r.changed)

  const requiresSimulationCount = input.actions.filter(
    ({ simulationResult }) =>
      (input.policyA.requireSimulation || input.policyB.requireSimulation) &&
      simulationResult === undefined,
  ).length

  return {
    policyA: input.policyA,
    policyB: input.policyB,
    results,
    summary: {
      total: results.length,
      changed: changedResults.length,
      newlyAllowed: changedResults.filter(r => r.direction === 'newly_allowed').length,
      newlyRejected: changedResults.filter(r => r.direction === 'newly_rejected').length,
      rejectionReasonChanged: changedResults.filter(r => r.direction === 'rejection_reason_changed').length,
      unchanged: results.length - changedResults.length,
      requiresSimulation: requiresSimulationCount,
    },
  }
}
