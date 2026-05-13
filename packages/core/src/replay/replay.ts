// Replay engine — feeds historical audit log entries through a new policy.
// Uses the same evaluation and comparison logic as the policy diff tool,
// applied to real historical data rather than hypothetical actions.

import type {
  ReplayableAuditLog,
  ReplayEntry,
  ReplayResult,
  ReplayOptions,
  ReplayDirection,
} from './types.js'
import type { Policy } from '../types/policy.js'
import type { PolicyEvaluation, PolicyRejectionReason } from '../types/receipt.js'
import type { ChangedCheck } from '../diff/types.js'
import { evaluate } from '../engine/evaluate.js'
import type { BoundAction } from '../types/action.js'

function getRejectionCheckName(reason: string): string {
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

function classifyChange(
  original: PolicyEvaluation,
  replay: PolicyEvaluation,
): {
  changed: boolean
  direction?: ReplayDirection
  changedChecks: ChangedCheck[]
} {
  const changed =
    original.passed !== replay.passed ||
    original.rejectionReason !== replay.rejectionReason

  let direction: ReplayDirection | undefined
  if (changed) {
    if (!original.passed && replay.passed) {
      direction = 'newly_allowed'
    } else if (original.passed && !replay.passed) {
      direction = 'newly_rejected'
    } else {
      direction = 'rejection_reason_changed'
    }
  }

  const allChecks = new Set([
    ...original.checksRun,
    ...replay.checksRun,
  ])

  const changedChecks: ChangedCheck[] = []
  for (const checkName of allChecks) {
    const inOriginal = original.checksRun.includes(checkName)
    const inReplay = replay.checksRun.includes(checkName)

    const isRejectionInOriginal =
      !original.passed &&
      original.rejectionReason !== undefined &&
      checkName === getRejectionCheckName(original.rejectionReason)

    const isRejectionInReplay =
      !replay.passed &&
      replay.rejectionReason !== undefined &&
      checkName === getRejectionCheckName(replay.rejectionReason)

    if (inOriginal !== inReplay || isRejectionInOriginal !== isRejectionInReplay) {
      changedChecks.push({
        checkName,
        inA: inOriginal,
        inB: inReplay,
        ...(isRejectionInOriginal && original.rejectionReason !== undefined
          ? { rejectionReasonA: original.rejectionReason }
          : {}),
        ...(isRejectionInReplay && replay.rejectionReason !== undefined
          ? { rejectionReasonB: replay.rejectionReason }
          : {}),
      })
    }
  }

  return {
    changed,
    ...(direction !== undefined ? { direction } : {}),
    changedChecks,
  }
}

export async function replayAuditLog(
  auditLog: ReplayableAuditLog,
  newPolicy: Policy,
  options?: ReplayOptions,
): Promise<ReplayResult> {
  const replayedAt = Date.now()

  const rawEntries = await auditLog.query({
    ...(options?.from !== undefined ? { from: options.from } : {}),
    ...(options?.to !== undefined ? { to: options.to } : {}),
    ...(options?.actionKind !== undefined ? { actionKind: options.actionKind } : {}),
    ...(options?.chain !== undefined ? { chain: options.chain } : {}),
  })

  const entries: ReplayEntry[] = []
  let skipped = 0

  for (const entry of rawEntries) {
    if (entry.evaluation === undefined || entry.action === undefined) {
      skipped++
      continue
    }

    const originalEvaluation: PolicyEvaluation = {
      passed: entry.evaluation.passed,
      checksRun: entry.evaluation.checksRun,
      ...(entry.evaluation.rejectionReason !== undefined
        ? { rejectionReason: entry.evaluation.rejectionReason as PolicyRejectionReason }
        : {}),
    }

    const boundAction: BoundAction = { action: entry.action, policy: newPolicy }
    const simulation = options?.includeSimulation === true ? entry.simulation : undefined
    const replayEvaluation = evaluate(boundAction, simulation)

    const { changed, direction, changedChecks } = classifyChange(
      originalEvaluation,
      replayEvaluation,
    )

    if (options?.onlyChanged === true && !changed) continue

    entries.push({
      auditEntryId: entry.id,
      timestamp: entry.timestamp,
      action: entry.action,
      originalEvaluation,
      replayEvaluation,
      originalStatus: entry.outcome.status,
      changed,
      ...(direction !== undefined ? { direction } : {}),
      changedChecks,
    })
  }

  const changedEntries = entries.filter(e => e.changed)
  const summary = {
    total: entries.length,
    changed: changedEntries.length,
    newlyAllowed: changedEntries.filter(e => e.direction === 'newly_allowed').length,
    newlyRejected: changedEntries.filter(e => e.direction === 'newly_rejected').length,
    rejectionReasonChanged: changedEntries.filter(e => e.direction === 'rejection_reason_changed').length,
    unchanged: entries.filter(e => !e.changed).length,
    skipped,
  }

  return {
    policy: newPolicy,
    replayedAt,
    entries,
    summary,
  }
}
