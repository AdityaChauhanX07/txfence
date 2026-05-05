import type { Action, BoundAction } from '../types/action.js'
import type { Policy, ChainId } from '../types/policy.js'
import type { ExecutionResult, SuccessReceipt, PolicyEvaluation } from '../types/receipt.js'
import type { SimulationResult } from '../types/simulation.js'
import type { CapLockProvider } from '../caps/provider.js'
import type { MetadataVerifier } from '../verification/provider.js'
import type { ReceiptStore } from '../storage/store.js'
import type { ApprovalProvider, ApprovalRequest, ApprovalDecision } from '../approval/types.js'
import { randomUUID } from 'node:crypto'
import { evaluate } from '../engine/index.js'
import { checkCapLock, checkMetadata } from '../engine/checks.js'
import type { AdapterMap } from './adapter.js'

function getSpendAmount(action: Action): bigint {
  if (action.kind === 'swap') return action.from.amount
  if (action.kind === 'transfer') return action.token.amount
  if (action.kind === 'contract_call' && action.value !== undefined) return action.value.amount
  return 0n
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
): Promise<ExecutionResult> {
  // Step 1
  const boundAction: BoundAction = { action, policy }

  // Step 2
  let evaluation = evaluate(boundAction)
  if (!evaluation.passed && evaluation.rejectionReason !== 'simulation_required_but_failed') {
    return { status: 'policy_rejected', action, evaluation }
  }

  // Step 2.5 — metadata verification
  if (metadataVerifier !== undefined) {
    const metadataResult = await checkMetadata(boundAction, metadataVerifier)
    if (!metadataResult.passed) {
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

  // Step 3
  let simulationResult: SimulationResult | undefined = undefined

  if (policy.requireSimulation) {
    const adapter = adapters[action.chain]
    const rpcUrl = rpcUrls[action.chain]

    if (adapter === undefined) {
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

    simulationResult = await adapter.simulate(action, action.chain, rpcUrl)

    if (!simulationResult.success) {
      return { status: 'simulation_failed', action, simulation: simulationResult }
    }

    evaluation = evaluate(boundAction, simulationResult)
    if (!evaluation.passed) {
      return { status: 'policy_rejected', action, evaluation }
    }
  }

  // Step 3.5 — cap lock
  let capLockId: string | undefined = undefined
  if (capLockProvider !== undefined) {
    const capLockResult = await checkCapLock(boundAction, capLockProvider)
    if (!capLockResult.passed) {
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
      return { status: 'approval_timeout', action: boundAction }
    }

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

    if (decision === null || decision === 'rejected') {
      return { status: 'approval_timeout', action: boundAction }
    }
    // decision === 'approved' — fall through to execution
  }

  // Step 5
  if (executor !== undefined) {
    const rpcUrl = rpcUrls[action.chain]
    if (rpcUrl === undefined) throw new Error(`no rpcUrl configured for chain: ${action.chain}`)
    try {
      const receipt = await executor(
        action,
        action.chain,
        rpcUrl,
        evaluation,
        simulationResult ?? {
          success: true,
          chain: action.chain,
          simulatedAtBlock: 0,
          gasEstimate: 0n,
          gasBufferApplied: 1,
          coverageLevel: 'none',
          caveats: [],
        },
      )
      if (capLockId !== undefined && policy.capLocks !== undefined && capLockProvider !== undefined) {
        for (const capLock of policy.capLocks) {
          await capLockProvider.commit(capLock.capId, capLockId, spendAmount)
        }
      }
      if (receiptStore !== undefined) {
        await receiptStore.save(receipt)
      }
      return { status: 'success', receipt }
    } catch (err) {
      if (capLockId !== undefined && policy.capLocks !== undefined && capLockProvider !== undefined) {
        for (const capLock of policy.capLocks) {
          await capLockProvider.release(capLock.capId, capLockId, spendAmount)
        }
      }
      const reason = err instanceof Error ? err.message : String(err)
      return { status: 'execution_failed', action, txHash: '', reason }
    }
  }
  return {
    status: 'execution_failed',
    action,
    txHash: '',
    reason: 'signing and broadcasting not yet implemented',
  }
}
