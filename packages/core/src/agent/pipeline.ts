import type { Action, BoundAction } from '../types/action.js'
import type { Policy, ChainId, TokenAmount } from '../types/policy.js'
import type { ExecutionResult, SuccessReceipt, PolicyEvaluation } from '../types/receipt.js'
import type { SimulationResult } from '../types/simulation.js'
import { evaluate } from '../engine/index.js'
import type { AdapterMap } from './adapter.js'

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
): Promise<ExecutionResult> {
  // Step 1
  const boundAction: BoundAction = { action, policy }

  // Step 2
  let evaluation = evaluate(boundAction)
  if (!evaluation.passed && evaluation.rejectionReason !== 'simulation_required_but_failed') {
    return { status: 'policy_rejected', action, evaluation }
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
      return { status: 'success', receipt }
    } catch (err) {
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
