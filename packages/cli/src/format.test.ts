import { describe, it, expect } from 'vitest'
import { formatSimulationResult, formatPolicyEvaluation, formatExecutionResult } from './format.js'
import type { SimulationResult, ExecutionResult, PolicyEvaluation, SuccessReceipt } from '@txfence/core'

const baseSimulation: SimulationResult = {
  success: true,
  chain: 'ethereum',
  simulatedAtBlock: 1000,
  gasEstimate: 21000n,
  gasBufferApplied: 1.2,
  coverageLevel: 'partial',
  caveats: ['state_may_diverge'],
}

const swapAction = {
  kind: 'swap' as const,
  chain: 'ethereum' as const,
  from: { token: 'ETH', amount: 1000000000000000000n, decimals: 18 },
  to: 'USDC',
  via: '0xrouter',
  maxSlippage: 50,
}

describe('formatSimulationResult', () => {
  it('formats a successful simulation correctly', () => {
    const output = formatSimulationResult(baseSimulation)
    expect(output).toContain('SUCCESS')
    expect(output).toContain('ethereum')
    expect(output).toContain('21000')
    expect(output).toContain('partial')
    expect(output).toContain('state_may_diverge')
  })

  it('formats a failed simulation correctly', () => {
    const failed: SimulationResult = {
      ...baseSimulation,
      success: false,
      coverageLevel: 'none',
      caveats: [],
    }
    const output = formatSimulationResult(failed)
    expect(output).toContain('FAILED')
    expect(output).toContain('none')
    const caveatsLine = output.split('\n').find(l => l.startsWith('Caveats:'))
    expect(caveatsLine).toContain('none')
  })
})

describe('formatPolicyEvaluation', () => {
  it('formats a passed evaluation correctly', () => {
    const evaluation: PolicyEvaluation = {
      passed: true,
      checksRun: ['checkChain', 'checkSpend'],
    }
    const output = formatPolicyEvaluation(evaluation)
    expect(output).toContain('PASSED')
    expect(output).toContain('checkChain')
    expect(output).not.toContain('Reason')
  })

  it('formats a failed evaluation correctly', () => {
    const evaluation: PolicyEvaluation = {
      passed: false,
      checksRun: ['checkChain'],
      rejectionReason: 'chain_not_allowed',
    }
    const output = formatPolicyEvaluation(evaluation)
    expect(output).toContain('FAILED')
    expect(output).toContain('chain_not_allowed')
  })
})

describe('formatExecutionResult', () => {
  it('formats a success result correctly', () => {
    const receipt: SuccessReceipt = {
      status: 'success',
      action: swapAction,
      policyEvaluation: { passed: true, checksRun: ['checkChain'] },
      simulation: baseSimulation,
      txHash: '0xabc',
      confirmedAtBlock: 100,
      confirmedAtMs: Date.now(),
      gasUsed: 21000n,
    }
    const result: ExecutionResult = { status: 'success', receipt }
    const output = formatExecutionResult(result)
    expect(output).toContain('SUCCESS')
    expect(output).toContain('0xabc')
    expect(output).toContain('100')
  })

  it('formats a policy_rejected result correctly', () => {
    const result: ExecutionResult = {
      status: 'policy_rejected',
      action: swapAction,
      evaluation: {
        passed: false,
        checksRun: ['checkSpend'],
        rejectionReason: 'spend_exceeds_cap',
      },
    }
    const output = formatExecutionResult(result)
    expect(output).toContain('REJECTED')
    expect(output).toContain('spend_exceeds_cap')
  })

  it('formats an execution_failed result correctly', () => {
    const result: ExecutionResult = {
      status: 'execution_failed',
      action: swapAction,
      txHash: '',
      reason: 'signing not yet implemented',
    }
    const output = formatExecutionResult(result)
    expect(output).toContain('FAILED')
    expect(output).toContain('signing not yet implemented')
  })
})
