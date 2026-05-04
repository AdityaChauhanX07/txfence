import type { Action, BoundAction } from '../types/action.js'
import type { Policy, ChainId, TokenAmount } from '../types/policy.js'
import type { ExecutionResult, SuccessReceipt, PolicyEvaluation } from '../types/receipt.js'
import type { SimulationResult } from '../types/simulation.js'
import type { CapLockProvider } from '../caps/provider.js'
import type { MetadataVerifier } from '../verification/provider.js'
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

  // Step 4
  let spend: TokenAmount | undefined
  if (action.kind === 'swap') {
    spend = action.from
  } else if (action.kind === 'transfer') {
    spend = action.token
  } else if (action.kind === 'contract_call' && action.value !== undefined) {
    spend = action.value
  }

  if (spend !== undefined && spend.amount > policy.humanApprovalThreshold.amount) {
    // human approval hook: in a full implementation this would pause and wait for external approval. returning approval_timeout as a placeholder until the approval system is implemented.
    return { status: 'approval_timeout', action: boundAction }
  }

  // Step 5
  if (executor !== undefined) {
    const rpcUrl = rpcUrls[action.chain]
    if (rpcUrl === undefined) throw new Error(`no rpcUrl configured for chain: ${action.chain}`)
    const spendAmount = getSpendAmount(action)
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
