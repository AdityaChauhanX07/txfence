import type { SimulationResult, ExecutionResult, PolicyEvaluation, SuccessReceipt } from '@txfence/core'

export function formatSimulationResult(result: SimulationResult): string {
  const lines = [
    `Simulation: ${result.success ? 'SUCCESS' : 'FAILED'}`,
    `Chain:      ${result.chain}`,
    `Block:      ${result.simulatedAtBlock}`,
    `Gas:        ${result.gasEstimate.toString()} (buffer: ${result.gasBufferApplied}x)`,
    `Coverage:   ${result.coverageLevel}`,
    `Caveats:    ${result.caveats.length > 0 ? result.caveats.join(', ') : 'none'}`,
  ]
  return lines.join('\n')
}

export function formatPolicyEvaluation(evaluation: PolicyEvaluation): string {
  const lines = [
    `Policy: ${evaluation.passed ? 'PASSED' : 'FAILED'}`,
    `Checks: ${evaluation.checksRun.join(', ')}`,
  ]
  if (!evaluation.passed && evaluation.rejectionReason !== undefined) {
    lines.push(`Reason: ${evaluation.rejectionReason}`)
  }
  return lines.join('\n')
}

export function formatExecutionResult(result: ExecutionResult): string {
  switch (result.status) {
    case 'success': {
      const r = result.receipt
      return [
        'Transaction: SUCCESS',
        `Hash:        ${r.txHash}`,
        `Block:       ${r.confirmedAtBlock}`,
        `Gas used:    ${r.gasUsed.toString()}`,
        formatPolicyEvaluation(r.policyEvaluation),
      ].join('\n')
    }
    case 'policy_rejected':
      return [
        'Policy: REJECTED',
        `Reason: ${result.evaluation.rejectionReason ?? 'unknown'}`,
        `Checks: ${result.evaluation.checksRun.join(', ')}`,
      ].join('\n')
    case 'simulation_failed':
      return [
        'Simulation: FAILED',
        formatSimulationResult(result.simulation),
      ].join('\n')
    case 'approval_timeout':
      return [
        'Status: APPROVAL REQUIRED',
        'The action exceeds the human approval threshold. Resubmit with explicit approval.',
      ].join('\n')
    case 'execution_failed':
      return [
        'Status: FAILED',
        `Reason: ${result.reason}`,
      ].join('\n')
  }
}
