import type { Policy, CapConfig } from '@txfence/core'

// Real Ethereum mainnet contract addresses
export const UNISWAP_V3_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564'
export const ONEINCH_V5_ROUTER = '0x1111111254EEB25477B68fb85Ed929f73A960582'

export const treasuryCapConfig: CapConfig[] = [
  {
    capId: 'treasury-usdc',
    absoluteCap: {
      maxAmount: 500_000_000_000n,  // 500,000 USDC (6 decimals)
      token: 'USDC',
    },
    rollingWindow: {
      windowMs: 3_600_000,          // 1 hour
      maxAmount: 100_000_000_000n,  // 100,000 USDC
      token: 'USDC',
    },
    warningThresholdPct: 80,
  },
]

export const treasuryPolicy: Policy = {
  chains: ['ethereum'],

  // Maximum 10,000 USDC per transaction
  maxSpendPerTx: { token: 'USDC', amount: 10_000_000_000n, decimals: 6 },

  // Allowed contracts: Uniswap V3 Router and 1inch V5 Router
  allowedContracts: [
    {
      address: UNISWAP_V3_ROUTER,
      chain: 'ethereum',
    },
    {
      address: ONEINCH_V5_ROUTER,
      chain: 'ethereum',
    },
  ],

  // Simulation required before every execution
  requireSimulation: true,

  // 1.2x gas buffer — matches the EVM adapter's DEFAULT_GAS_BUFFER
  gasBufferMultiplier: 1.2,

  // Human approval required above 50,000 USDC
  humanApprovalThreshold: { token: 'USDC', amount: 50_000_000_000n, decimals: 6 },

  // 60 second approval window
  humanApprovalTimeoutMs: 60_000,

  capLockMode: 'per-agent',
  capLocks: treasuryCapConfig,
}

// A stricter proposed policy for the diff example
export const proposedPolicy: Policy = {
  ...treasuryPolicy,

  // Reduce max spend per transaction to 5,000 USDC
  maxSpendPerTx: { token: 'USDC', amount: 5_000_000_000n, decimals: 6 },

  // Add bytecode hash pinning to Uniswap V3 (illustrative — not a real hash)
  allowedContracts: [
    {
      address: UNISWAP_V3_ROUTER,
      chain: 'ethereum',
      // In production, fetch the real bytecode hash:
      // const code = await publicClient.getBytecode({ address: UNISWAP_V3_ROUTER })
      // const hash = keccak256(code)
    },
    {
      address: ONEINCH_V5_ROUTER,
      chain: 'ethereum',
    },
  ],
}
