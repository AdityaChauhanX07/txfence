import { describe, it, expect, vi } from 'vitest'
import {
  createAgent,
  createMultiChainAdapter,
  getPolicyRejectionMessage,
  runPipeline,
  createMemoryCapLockProvider,
  createMemoryApprovalProvider,
} from '@txfence/core'
import type { TransferAction, BoundAction, Policy, SwapAction, SimulationResult, MetadataVerifier } from '@txfence/core'
import { simulateEvmAction, executeEvmAction, privateKeySigner } from '@txfence/evm'

// process is a Node.js global available in the vitest/Node.js runtime
declare const process: { env: Record<string, string | undefined> }

const ANVIL_RPC = process.env['ANVIL_URL'] ?? 'http://172.31.187.15:8545'
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

// suppress unused variable warnings for module-level declarations kept for future use
void TEST_ADDRESS
void adapter

// ── Pure policy pipeline tests (no Anvil required) ───────────────────────────

describe('policy pipeline — no Anvil required', () => {
  const purePolicy: Policy = {
    chains: ['ethereum'],
    maxSpendPerTx: { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
    allowedContracts: [{ address: '0xUNISWAP', chain: 'ethereum' }],
    requireSimulation: false,
    gasBufferMultiplier: 1.2,
    humanApprovalThreshold: { token: 'ETH', amount: 500000000000000000n, decimals: 18 },
    humanApprovalTimeoutMs: 100,
    capLockMode: 'per-agent',
  }

  const pureTransfer: TransferAction = {
    kind: 'transfer',
    chain: 'ethereum',
    token: { token: 'ETH', amount: 10000000000000000n, decimals: 18 },
    to: RECIPIENT,
  }

  it('rejects when slippage is not declared', async () => {
    const swapNoSlippage: SwapAction = {
      kind: 'swap', chain: 'ethereum',
      from: { token: 'ETH', amount: 10000000000000000n, decimals: 18 },
      to: 'USDC', via: '0xUNISWAP', maxSlippage: 0,
    }
    const result = await runPipeline(swapNoSlippage, purePolicy, {}, {})
    expect(result.status).toBe('policy_rejected')
    if (result.status === 'policy_rejected') {
      expect(result.evaluation.rejectionReason).toBe('slippage_not_declared')
    }
  })

  it('rejects when contract is not on allowlist', async () => {
    const unknownContract: SwapAction = {
      kind: 'swap', chain: 'ethereum',
      from: { token: 'ETH', amount: 10000000000000000n, decimals: 18 },
      to: 'USDC', via: '0xUNKNOWN_ROUTER', maxSlippage: 50,
    }
    const result = await runPipeline(unknownContract, purePolicy, {}, {})
    expect(result.status).toBe('policy_rejected')
    if (result.status === 'policy_rejected') {
      expect(result.evaluation.rejectionReason).toBe('contract_not_allowed')
    }
  })

  it('rejects when spend exceeds cap', async () => {
    const bigSpend: TransferAction = {
      kind: 'transfer', chain: 'ethereum',
      token: { token: 'ETH', amount: 200000000000000000n, decimals: 18 },
      to: RECIPIENT,
    }
    const result = await runPipeline(bigSpend, purePolicy, {}, {})
    expect(result.status).toBe('policy_rejected')
    if (result.status === 'policy_rejected') {
      expect(result.evaluation.rejectionReason).toBe('spend_exceeds_cap')
    }
  })

  it('rejects when gas buffer is below policy minimum', async () => {
    const lowBufferSim: SimulationResult = {
      success: true, wouldRevert: false, chain: 'ethereum',
      simulatedAtBlock: 1000, gasEstimate: 21000n,
      gasBufferApplied: 0.5,
      coverageLevel: 'basic', caveats: ['state_may_diverge'], provider: 'eth_call',
    }
    const mockLowBuffer = { simulate: vi.fn().mockResolvedValue(lowBufferSim) }
    const lowBufferPolicy: Policy = { ...purePolicy, requireSimulation: true }

    const result = await runPipeline(
      pureTransfer, lowBufferPolicy,
      { ethereum: mockLowBuffer },
      { ethereum: 'http://mock' },
    )
    expect(result.status).toBe('policy_rejected')
    if (result.status === 'policy_rejected') {
      expect(result.evaluation.rejectionReason).toBe('gas_buffer_insufficient')
    }
  })

  it('rejects when contract entry has expired', async () => {
    const expiredPolicy: Policy = {
      ...purePolicy,
      allowedContracts: [{
        address: '0xUNISWAP',
        chain: 'ethereum',
        expiresAt: Date.now() - 1000,
      }],
    }
    const swapExpired: SwapAction = {
      kind: 'swap', chain: 'ethereum',
      from: { token: 'ETH', amount: 10000000000000000n, decimals: 18 },
      to: 'USDC', via: '0xUNISWAP', maxSlippage: 50,
    }
    // checkMetadata (where expiresAt is checked) only runs when metadataVerifier is provided
    const mockVerifier: MetadataVerifier = {
      verifyContract: async () => ({ verified: true }),
    }
    const result = await runPipeline(
      swapExpired, expiredPolicy, {}, {}, undefined, undefined, mockVerifier,
    )
    expect(result.status).toBe('policy_rejected')
    if (result.status === 'policy_rejected') {
      expect(result.evaluation.rejectionReason).toBe('contract_entry_expired')
    }
  })

  it('returns approval_timeout when spend exceeds threshold and no provider configured', async () => {
    const approvalPolicy: Policy = {
      ...purePolicy,
      humanApprovalThreshold: { token: 'ETH', amount: 1n, decimals: 18 },
      humanApprovalTimeoutMs: 100,
    }
    const result = await runPipeline(pureTransfer, approvalPolicy, {}, {})
    expect(result.status).toBe('approval_timeout')
  })

  it('returns approval_timeout when provider rejects the request', async () => {
    const approvalProvider = createMemoryApprovalProvider()
    const approvalPolicy: Policy = {
      ...purePolicy,
      humanApprovalThreshold: { token: 'ETH', amount: 1n, decimals: 18 },
      humanApprovalTimeoutMs: 200,
    }

    setTimeout(() => {
      const pending = approvalProvider.pending()
      const first = pending[0]
      if (first !== undefined) {
        approvalProvider.decide(first.token, 'rejected')
      }
    }, 50)

    const result = await runPipeline(
      pureTransfer, approvalPolicy, {}, {}, undefined, undefined, undefined, approvalProvider,
    )
    expect(result.status).toBe('approval_timeout')
  })
})

// ── EVM integration tests — require Anvil ────────────────────────────────────

describe.skipIf(!process.env['ANVIL_URL'])('EVM integration — requires Anvil', () => {
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

  it('cap lock blocks second concurrent transfer', async () => {
    const capPolicy: Policy = {
      ...policy,
      maxSpendPerTx: { token: 'ETH', amount: 10000000000000000000n, decimals: 18 },
      requireSimulation: false,
      capLocks: [{ capId: 'test-cap', absoluteCap: { maxAmount: 150000000000000000n, token: 'ETH' } }],
    }

    const capLockProvider = createMemoryCapLockProvider([{
      capId: 'test-cap',
      absoluteCap: { maxAmount: 150000000000000000n, token: 'ETH' },
    }])

    const smallTransfer: TransferAction = {
      kind: 'transfer', chain: 'ethereum',
      token: { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
      to: RECIPIENT,
    }

    const [result1, result2] = await Promise.all([
      runPipeline(smallTransfer, capPolicy, { ethereum: evmAdapter }, { ethereum: ANVIL_RPC }, undefined, capLockProvider),
      runPipeline(smallTransfer, capPolicy, { ethereum: evmAdapter }, { ethereum: ANVIL_RPC }, undefined, capLockProvider),
    ])

    const rejections = [result1, result2].filter(r => {
      if (r.status !== 'policy_rejected') return false
      return r.evaluation.rejectionReason === 'cap_lock_unavailable'
    })
    expect(rejections).toHaveLength(1)

    const nonRejection = [result1, result2].find(r => r.status !== 'policy_rejected')
    expect(nonRejection).toBeDefined()
    expect(nonRejection?.status).toBe('execution_failed')
  }, 30000)

  it('approval approved via memory provider — proceeds to execution', async () => {
    const approvalProvider = createMemoryApprovalProvider()
    const approvalPolicy: Policy = {
      ...policy,
      humanApprovalThreshold: { token: 'ETH', amount: 1n, decimals: 18 },
      humanApprovalTimeoutMs: 5000,
      requireSimulation: true,
    }

    const smallTransfer: TransferAction = {
      kind: 'transfer', chain: 'ethereum',
      token: { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
      to: RECIPIENT,
    }

    setTimeout(() => {
      const pending = approvalProvider.pending()
      const first = pending[0]
      if (first !== undefined) {
        approvalProvider.decide(first.token, 'approved')
      }
    }, 200)

    const result = await runPipeline(
      smallTransfer, approvalPolicy,
      { ethereum: evmAdapter }, { ethereum: ANVIL_RPC },
      undefined, undefined, undefined, approvalProvider,
    )

    // Should have passed approval and reached execution_failed (no executor configured)
    expect(result.status).toBe('execution_failed')
    if (result.status === 'execution_failed') {
      expect(result.reason.code).toBe('no_executor')
    }
    expect(approvalProvider.pending()).toHaveLength(1)
  }, 30000)
})
