import { evaluate } from '../engine/evaluate.js'
import { evaluateNode } from '../engine/composite.js'
import type { PolicyNode } from '../engine/composite.js'
import type { Policy, ChainId } from '../types/policy.js'
import type { Action, BoundAction } from '../types/action.js'
import type { PolicyEvaluation } from '../types/receipt.js'
import type { SimulationResult } from '../types/simulation.js'
import type { AdapterMap } from './adapter.js'
import type { CapLockProvider } from '../caps/provider.js'
import type { TelemetryProvider } from '../telemetry/types.js'
import type { DryRunResult, DryRunBlocker } from './dry-run.js'
import { noopTelemetry } from '../telemetry/noop.js'

function getSpendAmount(action: Action): bigint {
  switch (action.kind) {
    case 'transfer': return action.token.amount
    case 'swap': return action.from.amount
    case 'contract_call': return action.value?.amount ?? 0n
  }
}

export async function runDryRun(
  action: Action,
  policy: Policy,
  adapters: AdapterMap,
  rpcUrls: Partial<Record<ChainId, string>>,
  capLockProvider?: CapLockProvider,
  policyNode?: PolicyNode,
  telemetryProvider?: TelemetryProvider,
): Promise<DryRunResult> {
  const telemetry = telemetryProvider ?? noopTelemetry
  const dryRunSpan = telemetry.startSpan('txfence.dry_run', {
    'txfence.chain': action.chain,
    'txfence.action.kind': action.kind,
  })

  const blockers: DryRunBlocker[] = []
  const dryRunAt = Date.now()
  let simulation: SimulationResult | undefined
  let approvalRequired = false
  let capLockAvailable = true

  try {
    // Step 1: Policy evaluation (pre-simulation)
    const boundAction: BoundAction = { action, policy }
    let evaluation: PolicyEvaluation
    if (policyNode !== undefined) {
      const nodeEval = evaluateNode(policyNode, action)
      const reason = nodeEval.firstRejectionReason
      evaluation = nodeEval.leaf ?? {
        passed: nodeEval.passed,
        checksRun: ['composite'],
        ...(reason !== undefined ? { rejectionReason: reason } : {}),
      }
    } else {
      evaluation = evaluate(boundAction)
    }

    // Policy rejection — skip simulation_required_but_failed, handled in Step 2
    if (!evaluation.passed && evaluation.rejectionReason !== 'simulation_required_but_failed') {
      const reason = evaluation.rejectionReason
      if (reason !== undefined) {
        blockers.push({ kind: 'policy_rejected', reason })
      }
      dryRunSpan.setAttribute('txfence.dry_run.blocked_by', 'policy_rejected')
      dryRunSpan.setStatus('error', evaluation.rejectionReason)
      return {
        action,
        evaluation,
        approvalRequired: false,
        capLockAvailable: true,
        wouldProceed: false,
        blockers,
        dryRunAt,
      }
    }

    // Step 2: Simulation
    const rpcUrl = rpcUrls[action.chain as ChainId]
    const adapter = adapters[action.chain as ChainId]

    if (adapter !== undefined && rpcUrl !== undefined) {
      simulation = await adapter.simulate(action, action.chain as ChainId, rpcUrl)
      if (!simulation.success) {
        blockers.push({ kind: 'simulation_failed', caveats: simulation.caveats })
      }
      const simulatedAt = Date.now()
      if (
        policy.simulationStalenessMs !== undefined &&
        Date.now() - simulatedAt > policy.simulationStalenessMs
      ) {
        blockers.push({ kind: 'simulation_stale', stalenessMs: Date.now() - simulatedAt })
      }
    } else if (policy.requireSimulation) {
      blockers.push({ kind: 'simulation_failed', caveats: [] })
    }

    // Step 3: Approval threshold check (no webhook dispatch)
    const spendAmount = getSpendAmount(action)
    const threshold = policy.humanApprovalThreshold
    if (spendAmount > threshold.amount) {
      approvalRequired = true
      blockers.push({
        kind: 'approval_required',
        thresholdAmount: threshold.amount,
        thresholdToken: threshold.token,
      })
    }

    // Step 4: Cap lock availability check (acquire then immediately release)
    if (capLockProvider !== undefined && policy.capLocks !== undefined) {
      for (const capConfig of policy.capLocks) {
        const result = await capLockProvider.acquire(
          capConfig.capId, spendAmount, policy.maxSpendPerTx.token,
        )
        if (result.granted) {
          await capLockProvider.release(capConfig.capId, result.lockId, spendAmount)
        } else {
          capLockAvailable = false
          blockers.push({ kind: 'cap_lock_unavailable', capId: capConfig.capId })
        }
      }
    }

    const wouldProceed = blockers.length === 0

    dryRunSpan.setAttribute('txfence.dry_run.would_proceed', wouldProceed)
    dryRunSpan.setAttribute('txfence.dry_run.blocker_count', blockers.length)
    dryRunSpan.setStatus(wouldProceed ? 'ok' : 'error')

    return {
      action,
      evaluation,
      ...(simulation !== undefined ? { simulation } : {}),
      approvalRequired,
      ...(approvalRequired
        ? { approvalThreshold: { amount: threshold.amount, token: threshold.token } }
        : {}),
      capLockAvailable,
      wouldProceed,
      blockers,
      dryRunAt,
    }
  } finally {
    dryRunSpan.end()
  }
}
