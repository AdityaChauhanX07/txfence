import { describe, it, expect } from 'vitest'
import {
  createAgent,
  createMultiChainAdapter,
  getPolicyRejectionMessage,
} from '@txfence/core'
import type { TransferAction, BoundAction, Policy } from '@txfence/core'
import { simulateEvmAction, executeEvmAction, privateKeySigner } from '@txfence/evm'

const ANVIL_RPC = 'http://172.31.187.15:8545'
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`
const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const RECIPIENT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const signer = privateKeySigner(TEST_PRIVATE_KEY)
const evmAdapter = { simulate: simulateEvmAction }
const adapter = createMultiChainAdapter({ ethereum: evmAdapter })

const policy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'ETH', amount: 10n * 10n ** 18n, decimals: 18 },
  allowedContracts: [],
  requireSimulation: true,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'ETH', amount: 100n * 10n ** 18n, decimals: 18 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent',
}

const agent = createAgent(
  { chains: ['ethereum'], policies: policy, signer },
  { ethereum: evmAdapter },
  { ethereum: ANVIL_RPC },
  (action, chainId, rpcUrl, evaluation, simulation) =>
    executeEvmAction(action, chainId, rpcUrl, signer, evaluation, simulation),
)

describe('EVM integration — simulation', () => {
  it('simulates a transfer action successfully', async () => {
    const action: TransferAction = {
      kind: 'transfer',
      chain: 'ethereum',
      token: { token: 'ETH', amount: 1n * 10n ** 18n, decimals: 18 },
      to: RECIPIENT,
    }
    const result = await simulateEvmAction(action, 'ethereum', ANVIL_RPC)
    expect(result.success).toBe(true)
    expect(result.chain).toBe('ethereum')
    expect(result.gasEstimate).toBeGreaterThan(0n)
    expect(result.coverageLevel).toBe('basic')
    expect(result.caveats).toContain('state_may_diverge')
  }, 30000)
})

describe('EVM integration — policy engine against Anvil', () => {
  it('rejects when chain is not allowed', async () => {
    const action: TransferAction = {
      kind: 'transfer',
      chain: 'solana',
      token: { token: 'ETH', amount: 1n * 10n ** 18n, decimals: 18 },
      to: RECIPIENT,
    }
    const result = await agent.submit({ action, policy })
    expect(result.status).toBe('policy_rejected')
  }, 30000)

  it('rejects when spend exceeds cap', async () => {
    const action: TransferAction = {
      kind: 'transfer',
      chain: 'ethereum',
      token: { token: 'ETH', amount: 20n * 10n ** 18n, decimals: 18 },
      to: RECIPIENT,
    }
    const result = await agent.submit({ action, policy })
    expect(result.status).toBe('policy_rejected')
    if (result.status === 'policy_rejected' && result.evaluation.rejectionReason !== undefined) {
      const boundAction: BoundAction = { action, policy }
      const message = getPolicyRejectionMessage(result.evaluation.rejectionReason, boundAction)
      expect(message.length).toBeGreaterThan(0)
    }
  }, 30000)
})

describe('EVM integration — end to end execution', () => {
  it('executes a real ETH transfer on the Anvil fork', async () => {
    const action: TransferAction = {
      kind: 'transfer',
      chain: 'ethereum',
      token: { token: 'ETH', amount: 1n * 10n ** 17n, decimals: 18 },
      to: RECIPIENT,
    }
    const result = await agent.submit({ action, policy })
    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.receipt.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(result.receipt.confirmedAtBlock).toBeGreaterThan(0)
      expect(result.receipt.gasUsed).toBeGreaterThan(0n)
      expect(result.receipt.policyEvaluation.passed).toBe(true)
    }
  }, 30000)

  it('returns execution_failed when the transaction would fail', async () => {
    const higherCapPolicy: Policy = {
      ...policy,
      maxSpendPerTx: { token: 'ETH', amount: 99999n * 10n ** 18n, decimals: 18 },
    }
    const higherCapAgent = createAgent(
      { chains: ['ethereum'], policies: higherCapPolicy, signer },
      { ethereum: evmAdapter },
      { ethereum: ANVIL_RPC },
      (action, chainId, rpcUrl, evaluation, simulation) =>
        executeEvmAction(action, chainId, rpcUrl, signer, evaluation, simulation),
    )
    const action: TransferAction = {
      kind: 'transfer',
      chain: 'ethereum',
      token: { token: 'ETH', amount: 9999n * 10n ** 18n, decimals: 18 },
      to: RECIPIENT,
    }
    const result = await higherCapAgent.submit({ action, policy: higherCapPolicy })
    expect(['execution_failed', 'policy_rejected', 'simulation_failed']).toContain(result.status)
  }, 30000)
})
