// This example demonstrates the full txfence pipeline:
// policy check → EVM simulation via viem → human approval threshold check → execution (placeholder)
// No real funds or private keys are required. The execution step returns execution_failed
// because signing and broadcasting are not yet implemented.

import { createAgent } from '@txfence/core'
import type { ChainAdapter } from '@txfence/core'
import { simulateEvmAction } from '@txfence/evm'

const evmAdapter: ChainAdapter = {
  simulate: simulateEvmAction,
}

const policy = {
  chains: ['ethereum'] as const,
  maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 6 },
  allowedContracts: [
    {
      address: '0x1111111254EEB25477B68fb85Ed929f73A960582',
      chain: 'ethereum' as const,
    },
  ],
  requireSimulation: true,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent' as const,
}

const swapAction = {
  kind: 'swap' as const,
  chain: 'ethereum' as const,
  from: { token: 'USDC', amount: 500n, decimals: 6 },
  to: 'ETH',
  via: '0x1111111254EEB25477B68fb85Ed929f73A960582',
  maxSlippage: 50,
}

const agent = createAgent(
  { chains: policy.chains, policies: policy, signer: { sign: async () => '', address: '' } },
  { ethereum: evmAdapter },
  { ethereum: 'https://ethereum.publicnode.com' },
)

const result = await agent.submit({ action: swapAction, policy })

switch (result.status) {
  case 'success':
    console.log('Pipeline succeeded', result.receipt)
    break
  case 'policy_rejected':
    console.log('Policy rejected', result.evaluation)
    break
  case 'simulation_failed':
    console.log('Simulation failed', result.simulation)
    break
  case 'approval_timeout':
    console.log('Approval required above threshold')
    break
  case 'execution_failed':
    console.log('Execution failed (expected — signing not yet implemented)', result.reason)
    break
}
