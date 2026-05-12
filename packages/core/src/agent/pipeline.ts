import type { Action, BoundAction } from '../types/action.js'
import type { Policy, ChainId } from '../types/policy.js'
import type { ExecutionResult, SuccessReceipt, PolicyEvaluation, PolicyRejectionReason } from '../types/receipt.js'
import { formatExecutionFailureReason } from '../types/receipt.js'
import type { SimulationResult } from '../types/simulation.js'
import type { CapLockProvider } from '../caps/provider.js'
import type { MetadataVerifier } from '../verification/provider.js'
import type { ReceiptStore } from '../storage/store.js'
import type { ApprovalProvider, ApprovalRequest, ApprovalDecision } from '../approval/types.js'
import type { TelemetryProvider } from '../telemetry/types.js'
import type { NotificationProvider } from '../notifications/types.js'
import { randomUUID } from 'node:crypto'
import { evaluate, evaluateNode } from '../engine/index.js'
import type { PolicyNode } from '../engine/composite.js'
import { checkCapLock, checkMetadata } from '../engine/checks.js'
import { noopTelemetry } from '../telemetry/noop.js'
import type { AdapterMap } from './adapter.js'

function getSpendAmount(action: Action): bigint {
  if (action.kind === 'swap') return action.from.amount
  if (action.kind === 'transfer') return action.token.amount
  if (action.kind === 'contract_call' && action.value !== undefined) return action.value.amount
  return 0n
}

// Mirrors AuditEntry.outcome from @txfence/audit without creating a circular dep.
// @txfence/audit defines AuditOutcome with the same shape and is assignable here.
type PipelineAuditOutcome =
  | { status: 'success'; txHash: string; confirmedAtBlock: number; gasUsed: string }
  | { status: 'policy_rejected'; reason: PolicyRejectionReason | undefined }
  | { status: 'simulation_failed' }
  | { status: 'simulation_stale'; stalenessMs: number }
  | { status: 'approval_timeout' }
  | { status: 'execution_failed'; reason: string }
  | { status: 'dry_run'; stoppedAt: 'policy' | 'simulation' | 'approval' | 'execution' }

type PipelineAuditLog = {
  record: (entry: {
    id: string
    timestamp: number
    action: Action
    policySnapshot: Policy
    evaluation: PolicyEvaluation
    simulation?: SimulationResult
    outcome: PipelineAuditOutcome
  }) => Promise<void>
}

function buildAuditOutcome(result: ExecutionResult): PipelineAuditOutcome {
  switch (result.status) {
    case 'success':
      return {
        status: 'success',
        txHash: result.receipt.txHash,
        confirmedAtBlock: result.receipt.confirmedAtBlock,
        gasUsed: result.receipt.gasUsed.toString(),
      }
    case 'policy_rejected':
      return { status: 'policy_rejected', reason: result.evaluation.rejectionReason }
    case 'simulation_failed':
      return { status: 'simulation_failed' }
    case 'simulation_stale':
      return { status: 'simulation_stale', stalenessMs: result.stalenessMs }
    case 'approval_timeout':
      return { status: 'approval_timeout' }
    case 'execution_failed':
      return { status: 'execution_failed', reason: formatExecutionFailureReason(result.reason) }
  }
}

export async function runPipeline(
  action: Action,
  policy: Policy,
  adapters: AdapterMap,
  rpcUrls: Partial<Record<ChainId, string>>,
  executor?: (
    action: Action,
    chainId: ChainId,
    rpcUrl: string,
    evaluation: PolicyEvaluation,
    simulation: SimulationResult,
  ) => Promise<SuccessReceipt>,
  capLockProvider?: CapLockProvider,
  metadataVerifier?: MetadataVerifier,
  approvalProvider?: ApprovalProvider,
  receiptStore?: ReceiptStore,
  auditLog?: PipelineAuditLog,
  telemetryProvider?: TelemetryProvider,
  policyNode?: PolicyNode,
  notificationProvider?: NotificationProvider,
): Promise<ExecutionResult> {
  const telemetry = telemetryProvider ?? noopTelemetry
  const pipelineSpan = telemetry.startSpan('txfence.pipeline', {
    'txfence.chain': action.chain,
    'txfence.action.kind': action.kind,
  })

  try {
    let auditEvaluation: PolicyEvaluation = { passed: false, checksRun: [] }
    let auditSimulation: SimulationResult | undefined
    let simulatedAt = 0

    const result = await (async (): Promise<ExecutionResult> => {
      // Step 1
      const boundAction: BoundAction = { action, policy }

      // Step 2 — policy evaluation
      const evalSpan = telemetry.startSpan('txfence.policy.evaluate', {
        'txfence.chain': action.chain,
        'txfence.action.kind': action.kind,
      })
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
      auditEvaluation = evaluation
      evalSpan.setAttribute('txfence.evaluation.passed', evaluation.passed)
      if (evaluation.rejectionReason !== undefined) {
        evalSpan.setAttribute('txfence.rejection_reason', evaluation.rejectionReason)
      }
      evalSpan.setStatus(evaluation.passed ? 'ok' : 'error', evaluation.rejectionReason)
      evalSpan.end()

      if (!evaluation.passed && evaluation.rejectionReason !== 'simulation_required_but_failed') {
        pipelineSpan.setAttribute('txfence.status', 'policy_rejected')
        pipelineSpan.setAttribute('txfence.rejection_reason', evaluation.rejectionReason ?? '')
        pipelineSpan.setStatus('error', evaluation.rejectionReason)
        if (evaluation.rejectionReason !== undefined) {
          void notificationProvider?.notify({ kind: 'policy_rejected', action, reason: evaluation.rejectionReason, evaluation })
        }
        return { status: 'policy_rejected', action, evaluation }
      }

      // Step 2.5 — metadata verification
      if (metadataVerifier !== undefined) {
        const metadataResult = await checkMetadata(boundAction, metadataVerifier)
        if (!metadataResult.passed) {
          pipelineSpan.setAttribute('txfence.status', 'policy_rejected')
          pipelineSpan.setAttribute('txfence.rejection_reason', metadataResult.reason ?? '')
          pipelineSpan.setStatus('error', metadataResult.reason)
          return {
            status: 'policy_rejected',
            action,
            evaluation: {
              passed: false,
              checksRun: ['checkMetadata'],
              ...(metadataResult.reason !== undefined ? { rejectionReason: metadataResult.reason } : {}),
            },
          }
        }
      }

      // Step 3 — simulation
      let simulationResult: SimulationResult | undefined = undefined

      if (policy.requireSimulation) {
        const adapter = adapters[action.chain]
        const rpcUrl = rpcUrls[action.chain]

        if (adapter === undefined) {
          pipelineSpan.setAttribute('txfence.status', 'policy_rejected')
          pipelineSpan.setAttribute('txfence.rejection_reason', 'chain_not_allowed')
          pipelineSpan.setStatus('error', 'chain_not_allowed')
          return {
            status: 'policy_rejected',
            action,
            evaluation: {
              passed: false,
              checksRun: ['adapter_lookup'],
              rejectionReason: 'chain_not_allowed',
            },
          }
        }

        if (rpcUrl === undefined) {
          throw new Error(`no rpcUrl configured for chain: ${action.chain}`)
        }

        const simSpan = telemetry.startSpan('txfence.simulation', {
          'txfence.chain': action.chain,
        })
        simulationResult = await adapter.simulate(action, action.chain, rpcUrl)
        simulatedAt = Date.now()
        auditSimulation = simulationResult
        simSpan.setAttribute('txfence.simulation.provider', simulationResult.provider)
        simSpan.setAttribute('txfence.simulation.coverage', simulationResult.coverageLevel)
        simSpan.setAttribute('txfence.simulation.gas_estimate', Number(simulationResult.gasEstimate))
        simSpan.setAttribute('txfence.simulation.would_revert', simulationResult.wouldRevert)
        simSpan.setStatus(simulationResult.success ? 'ok' : 'error')
        simSpan.end()

        if (!simulationResult.success) {
          pipelineSpan.setAttribute('txfence.status', 'simulation_failed')
          pipelineSpan.setStatus('error', 'simulation failed')
          return { status: 'simulation_failed', action, simulation: simulationResult }
        }

        if (policyNode !== undefined) {
          const nodeEval = evaluateNode(policyNode, action, simulationResult)
          const reason = nodeEval.firstRejectionReason
          evaluation = nodeEval.leaf ?? {
            passed: nodeEval.passed,
            checksRun: ['composite'],
            ...(reason !== undefined ? { rejectionReason: reason } : {}),
          }
        } else {
          evaluation = evaluate(boundAction, simulationResult)
        }
        auditEvaluation = evaluation
        if (!evaluation.passed) {
          pipelineSpan.setAttribute('txfence.status', 'policy_rejected')
          pipelineSpan.setAttribute('txfence.rejection_reason', evaluation.rejectionReason ?? '')
          pipelineSpan.setStatus('error', evaluation.rejectionReason)
          if (evaluation.rejectionReason !== undefined) {
            void notificationProvider?.notify({ kind: 'policy_rejected', action, reason: evaluation.rejectionReason, evaluation })
          }
          return { status: 'policy_rejected', action, evaluation }
        }
      }

      // Step 3.5 — cap lock
      let capLockId: string | undefined = undefined
      if (capLockProvider !== undefined) {
        const capLockResult = await checkCapLock(boundAction, capLockProvider)
        if (!capLockResult.passed) {
          pipelineSpan.setAttribute('txfence.status', 'policy_rejected')
          pipelineSpan.setAttribute('txfence.rejection_reason', 'cap_lock_unavailable')
          pipelineSpan.setStatus('error', 'cap_lock_unavailable')
          return {
            status: 'policy_rejected',
            action,
            evaluation: {
              passed: false,
              checksRun: ['checkCapLock'],
              rejectionReason: 'cap_lock_unavailable',
            },
          }
        }
        capLockId = capLockResult.lockId
      }

      // Step 4 — human approval
      const spendAmount = getSpendAmount(action)
      const threshold = policy.humanApprovalThreshold

      if (spendAmount > threshold.amount) {
        if (approvalProvider === undefined) {
          pipelineSpan.setAttribute('txfence.status', 'approval_timeout')
          pipelineSpan.setStatus('error', 'approval timeout')
          return { status: 'approval_timeout', action: boundAction }
        }

        const approvalSpan = telemetry.startSpan('txfence.approval', {
          'txfence.chain': action.chain,
        })

        const token = randomUUID()
        const now = Date.now()
        const expiresAt = now + policy.humanApprovalTimeoutMs

        const approvalReq: ApprovalRequest = {
          token,
          action,
          simulation: simulationResult !== undefined ? {
            gasEstimate: simulationResult.gasEstimate.toString(),
            coverageLevel: simulationResult.coverageLevel,
            caveats: simulationResult.caveats,
          } : {
            gasEstimate: '0',
            coverageLevel: 'none',
            caveats: [],
          },
          policyContext: {
            maxSpendPerTx: {
              token: policy.maxSpendPerTx.token,
              amount: policy.maxSpendPerTx.amount.toString(),
            },
            humanApprovalThreshold: {
              token: policy.humanApprovalThreshold.token,
              amount: policy.humanApprovalThreshold.amount.toString(),
            },
          },
          requestedAt: new Date(now).toISOString(),
          expiresAt: new Date(expiresAt).toISOString(),
          approveUrl: '',
          rejectUrl: '',
        }

        await approvalProvider.request(approvalReq)
        void notificationProvider?.notify({
          kind: 'approval_requested',
          action,
          requestedAt: now,
          expiresAt,
          thresholdAmount: threshold.amount,
          thresholdToken: threshold.token,
        })

        let decision: ApprovalDecision | null = null
        let timedOut = false
        const pollIntervalMs = 50

        const pollLoop = async (): Promise<void> => {
          while (!timedOut) {
            decision = await approvalProvider.poll(token)
            if (decision !== null) return
            await new Promise<void>(resolve => setTimeout(resolve, pollIntervalMs))
          }
        }

        const timeoutPromise = new Promise<void>(resolve =>
          setTimeout(() => { timedOut = true; resolve() }, policy.humanApprovalTimeoutMs)
        )

        await Promise.race([pollLoop(), timeoutPromise])
        timedOut = true

        approvalSpan.setAttribute('txfence.approval.decision', decision ?? 'timeout')
        approvalSpan.setStatus(decision === 'approved' ? 'ok' : 'error')
        approvalSpan.end()

        const finalDecision: 'approved' | 'rejected' | 'timeout' =
          decision === 'approved' ? 'approved'
          : decision === 'rejected' ? 'rejected'
          : 'timeout'
        void notificationProvider?.notify({ kind: 'approval_decision', action, decision: finalDecision, decidedAt: Date.now() })

        if (decision === null || decision === 'rejected') {
          pipelineSpan.setAttribute('txfence.status', 'approval_timeout')
          pipelineSpan.setStatus('error', 'approval timeout')
          return { status: 'approval_timeout', action: boundAction }
        }
        // decision === 'approved' — fall through to execution
      }

      // Step 5 — staleness check
      if (
        policy.simulationStalenessMs !== undefined &&
        simulationResult !== undefined
      ) {
        const stalenessMs = Date.now() - simulatedAt
        if (stalenessMs >= policy.simulationStalenessMs) {
          pipelineSpan.setAttribute('txfence.status', 'simulation_stale')
          pipelineSpan.setAttribute('txfence.staleness_ms', stalenessMs)
          pipelineSpan.setStatus('error', 'simulation stale')
          return {
            status: 'simulation_stale',
            action,
            simulation: simulationResult,
            stalenessMs,
          }
        }
      }

      if (executor !== undefined) {
        const rpcUrl = rpcUrls[action.chain]
        if (rpcUrl === undefined) throw new Error(`no rpcUrl configured for chain: ${action.chain}`)

        const execSpan = telemetry.startSpan('txfence.execution', {
          'txfence.chain': action.chain,
          'txfence.action.kind': action.kind,
        })
        try {
          const receipt = await executor(
            action,
            action.chain,
            rpcUrl,
            evaluation,
            simulationResult ?? {
              success: true,
              wouldRevert: false,
              chain: action.chain,
              simulatedAtBlock: 0,
              gasEstimate: 0n,
              gasBufferApplied: 1,
              coverageLevel: 'none',
              caveats: [],
              provider: 'eth_call',
            },
          )
          execSpan.setStatus('ok')
          if (capLockId !== undefined && policy.capLocks !== undefined && capLockProvider !== undefined) {
            for (const capLock of policy.capLocks) {
              await capLockProvider.commit(capLock.capId, capLockId, spendAmount)
            }
          }
          if (receiptStore !== undefined) {
            await receiptStore.save(receipt)
          }
          pipelineSpan.setAttribute('txfence.status', 'success')
          pipelineSpan.setAttribute('txfence.tx_hash', receipt.txHash)
          pipelineSpan.setAttribute('txfence.confirmed_at_block', receipt.confirmedAtBlock)
          pipelineSpan.setStatus('ok')
          void notificationProvider?.notify({ kind: 'execution_success', receipt })
          return { status: 'success', receipt }
        } catch (err) {
          if (capLockId !== undefined && policy.capLocks !== undefined && capLockProvider !== undefined) {
            for (const capLock of policy.capLocks) {
              await capLockProvider.release(capLock.capId, capLockId, spendAmount)
            }
          }
          const message = err instanceof Error ? err.message : String(err)
          const reason = { code: 'executor_threw' as const, message, cause: err }
          execSpan.setStatus('error', message)
          pipelineSpan.setAttribute('txfence.status', 'execution_failed')
          pipelineSpan.setStatus('error', message)
          void notificationProvider?.notify({ kind: 'execution_failed', action, reason })
          return { status: 'execution_failed', action, txHash: '', reason }
        } finally {
          execSpan.end()
        }
      }

      pipelineSpan.setAttribute('txfence.status', 'execution_failed')
      pipelineSpan.setStatus('error', 'no executor configured')
      void notificationProvider?.notify({ kind: 'execution_failed', action, reason: { code: 'no_executor' } })
      return {
        status: 'execution_failed',
        action,
        txHash: '',
        reason: { code: 'no_executor' },
      }
    })()

    if (auditLog !== undefined) {
      const auditEval = result.status === 'policy_rejected' ? result.evaluation : auditEvaluation
      await auditLog.record({
        id: randomUUID(),
        timestamp: Date.now(),
        action,
        policySnapshot: policy,
        evaluation: auditEval,
        ...(auditSimulation !== undefined ? { simulation: auditSimulation } : {}),
        outcome: buildAuditOutcome(result),
      })
    }

    return result
  } finally {
    pipelineSpan.end()
  }
}
