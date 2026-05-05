import { simulateEvmAction } from '@txfence/evm'
import type { TxfenceConfig } from '@txfence/mcp/src/config.js'

const config: TxfenceConfig = {
  chains: ['ethereum'],
  adapters: {
    ethereum: { simulate: simulateEvmAction },
  },
  rpcUrls: {
    ethereum: 'https://ethereum.publicnode.com',
  },
  policy: {
    chains: ['ethereum'],
    maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 6 },
    allowedContracts: [],
    requireSimulation: true,
    gasBufferMultiplier: 1.2,
    humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
    humanApprovalTimeoutMs: 30000,
    capLockMode: 'per-agent',
  },
}

export default config