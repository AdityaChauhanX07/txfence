import { describe, it, expect, vi } from 'vitest'
import { createAgent } from './create.js'
import type { Policy } from '../types/policy.js'
import type { Intent, IntentStep } from '../intent/types.js'
import type { SuccessReceipt } from '../types/receipt.js'

const txPolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'USDC', amount: 10000n, decimals: 6 },
  allowedContracts: [],
  requireSimulation: false,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 100000n, decimals: 6 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent',
}

const makeStep = (id: string, amount: bigint, dependsOn?: string[]): IntentStep => ({
  id,
  action: {
    kind: 'transfer' as const,
    chain: 'ethereum' as const,
    token: { token: 'USDC', amount, decimals: 6 },
    to: '0x0000000000000000000000000000000000000001',
  },
  ...(dependsOn !== undefined ? { dependsOn } : {}),
})

const makeReceipt = (): SuccessReceipt => ({
  status: 'success',
  action: {
    kind: 'transfer', chain: 'ethereum',
    token: { token: 'USDC', amount: 1000n, decimals: 6 },
    to: '0x0000000000000000000000000000000000000001',
  },
  policyEvaluation: { passed: true, checksRun: ['checkChain'] },
  simulation: {
    success: true, wouldRevert: false, chain: 'ethereum',
    simulatedAtBlock: 1000, gasEstimate: 21000n, gasBufferApplied: 1.2,
    coverageLevel: 'basic', caveats: [], provider: 'eth_call',
  },
  txHash: '0xmock',
  confirmedAtBlock: 1000,
  confirmedAtMs: Date.now(),
  gasUsed: 21000n,
})

function makeAgent(executor?: NonNullable<Parameters<typeof createAgent>[3]>) {
  return createAgent(
    {
      chains: ['ethereum'],
      policies: txPolicy,
      signer: {
        address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        sign: async () => { throw new Error('not implemented') },
      },
    },
    {},
    { ethereum: 'http://mock-rpc' },
    executor,
  )
}

// ── agent.executeIntent ───────────────────────────────────────────────────────

describe('agent.executeIntent', () => {
  it('is available on the agent object', () => {
    const agent = makeAgent()
    expect(typeof agent.executeIntent).toBe('function')
  })

  it('executes a single step intent and returns completed status', async () => {
    const executor = vi.fn().mockResolvedValue(makeReceipt())
    const agent = makeAgent(executor)
    const intent: Intent = {
      id: 'test-intent',
      steps: [makeStep('A', 1000n)],
    }
    const result = await agent.executeIntent(intent)
    expect(result.status).toBe('completed')
    expect(result.intentId).toBe('test-intent')
    expect(result.completedStepIds).toContain('A')
  })

  it('executes a multi-step intent in dependency order', async () => {
    const callOrder: string[] = []
    const executor = vi.fn().mockImplementation(async (action: { token?: { amount: bigint } }) => {
      callOrder.push(String(action.token?.amount ?? 0n))
      return makeReceipt()
    })
    const agent = makeAgent(executor as NonNullable<Parameters<typeof createAgent>[3]>)
    const intent: Intent = {
      id: 'ordered-intent',
      steps: [
        makeStep('first', 1000n),
        makeStep('second', 2000n, ['first']),
      ],
    }
    await agent.executeIntent(intent)
    expect(callOrder[0]).toBe('1000')
    expect(callOrder[1]).toBe('2000')
  })

  it('returns rejected when intent policy fails', async () => {
    const agent = makeAgent()
    const intent: Intent = {
      id: 'invalid-intent',
      steps: [makeStep('A', 1000n)],
      intentPolicy: { allowedChains: ['solana'] },
    }
    const result = await agent.executeIntent(intent)
    expect(result.status).toBe('rejected')
  })

  it('uses overridden executor when provided', async () => {
    const agentExecutor = vi.fn().mockResolvedValue(makeReceipt())
    const overrideExecutor = vi.fn().mockResolvedValue(makeReceipt())
    const agent = makeAgent(agentExecutor)
    const intent: Intent = {
      id: 'override-intent',
      steps: [makeStep('A', 1000n)],
    }
    await agent.executeIntent(intent, { executor: overrideExecutor as NonNullable<Parameters<typeof createAgent>[3]> })
    expect(overrideExecutor).toHaveBeenCalled()
    expect(agentExecutor).not.toHaveBeenCalled()
  })

  it('does not accept new intents while shutting down', async () => {
    const agent = makeAgent()
    void agent.shutdown(0)
    const intent: Intent = { id: 'late-intent', steps: [makeStep('A', 1000n)] }
    await expect(agent.executeIntent(intent)).rejects.toThrow('shutting down')
  })
})
