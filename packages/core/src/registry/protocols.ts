// Built-in protocol registry.
// Addresses are checksummed mainnet addresses.
// Verify before use in production — protocol contracts can be upgraded.
// Submit a PR to add missing protocols: github.com/AdityaChauhanX07/txfence

import type { ProtocolDefinition } from './types.js'

export const BUILT_IN_PROTOCOLS: ProtocolDefinition[] = [

  // ── Uniswap V3 ───────────────────────────────────────────────────────────
  {
    id: 'uniswap-v3',
    name: 'Uniswap V3',
    chain: 'ethereum',
    website: 'https://uniswap.org',
    contracts: [
      { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', role: 'router', description: 'SwapRouter' },
      { address: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', role: 'router', description: 'SwapRouter02' },
      { address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', role: 'factory', description: 'UniswapV3Factory' },
      { address: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6', role: 'quoter', description: 'Quoter' },
    ],
  },
  {
    id: 'uniswap-v3',
    name: 'Uniswap V3',
    chain: 'arbitrum',
    website: 'https://uniswap.org',
    contracts: [
      { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', role: 'router', description: 'SwapRouter' },
      { address: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', role: 'router', description: 'SwapRouter02' },
      { address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', role: 'factory', description: 'UniswapV3Factory' },
    ],
  },
  {
    id: 'uniswap-v3',
    name: 'Uniswap V3',
    chain: 'optimism',
    website: 'https://uniswap.org',
    contracts: [
      { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', role: 'router', description: 'SwapRouter' },
      { address: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', role: 'router', description: 'SwapRouter02' },
      { address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', role: 'factory', description: 'UniswapV3Factory' },
    ],
  },
  {
    id: 'uniswap-v3',
    name: 'Uniswap V3',
    chain: 'base',
    website: 'https://uniswap.org',
    contracts: [
      { address: '0x2626664c2603336E57B271c5C0b26F421741e481', role: 'router', description: 'SwapRouter02' },
      { address: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD', role: 'factory', description: 'UniswapV3Factory' },
    ],
  },

  // ── 1inch V5 ─────────────────────────────────────────────────────────────
  {
    id: '1inch-v5',
    name: '1inch V5',
    chain: 'ethereum',
    website: 'https://1inch.io',
    contracts: [
      { address: '0x1111111254EEB25477B68fb85Ed929f73A960582', role: 'router', description: 'AggregationRouterV5' },
    ],
  },
  {
    id: '1inch-v5',
    name: '1inch V5',
    chain: 'arbitrum',
    website: 'https://1inch.io',
    contracts: [
      { address: '0x1111111254EEB25477B68fb85Ed929f73A960582', role: 'router', description: 'AggregationRouterV5' },
    ],
  },
  {
    id: '1inch-v5',
    name: '1inch V5',
    chain: 'optimism',
    website: 'https://1inch.io',
    contracts: [
      { address: '0x1111111254EEB25477B68fb85Ed929f73A960582', role: 'router', description: 'AggregationRouterV5' },
    ],
  },
  {
    id: '1inch-v5',
    name: '1inch V5',
    chain: 'base',
    website: 'https://1inch.io',
    contracts: [
      { address: '0x1111111254EEB25477B68fb85Ed929f73A960582', role: 'router', description: 'AggregationRouterV5' },
    ],
  },

  // ── Aave V3 ──────────────────────────────────────────────────────────────
  {
    id: 'aave-v3',
    name: 'Aave V3',
    chain: 'ethereum',
    website: 'https://aave.com',
    contracts: [
      { address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', role: 'lending', description: 'Pool' },
      { address: '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e', role: 'other', description: 'PoolAddressesProvider' },
    ],
  },
  {
    id: 'aave-v3',
    name: 'Aave V3',
    chain: 'arbitrum',
    website: 'https://aave.com',
    contracts: [
      { address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', role: 'lending', description: 'Pool' },
    ],
  },
  {
    id: 'aave-v3',
    name: 'Aave V3',
    chain: 'optimism',
    website: 'https://aave.com',
    contracts: [
      { address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', role: 'lending', description: 'Pool' },
    ],
  },
  {
    id: 'aave-v3',
    name: 'Aave V3',
    chain: 'base',
    website: 'https://aave.com',
    contracts: [
      { address: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5', role: 'lending', description: 'Pool' },
    ],
  },

  // ── Lido ─────────────────────────────────────────────────────────────────
  {
    id: 'lido',
    name: 'Lido',
    chain: 'ethereum',
    website: 'https://lido.fi',
    contracts: [
      { address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', role: 'staking', description: 'stETH / submit' },
      { address: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1', role: 'staking', description: 'WithdrawalQueueERC721' },
    ],
  },

  // ── Compound V3 ──────────────────────────────────────────────────────────
  {
    id: 'compound-v3',
    name: 'Compound V3',
    chain: 'ethereum',
    website: 'https://compound.finance',
    contracts: [
      { address: '0xc3d688B66703497DAA19211EEdff47f25384cdc3', role: 'lending', description: 'cUSDCv3' },
      { address: '0xA17581A9E3356d9A858b789D68B4d866e593aE94', role: 'lending', description: 'cWETHv3' },
    ],
  },
  {
    id: 'compound-v3',
    name: 'Compound V3',
    chain: 'arbitrum',
    website: 'https://compound.finance',
    contracts: [
      { address: '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf', role: 'lending', description: 'cUSDCv3' },
    ],
  },

  // ── Curve Finance ────────────────────────────────────────────────────────
  {
    id: 'curve',
    name: 'Curve Finance',
    chain: 'ethereum',
    website: 'https://curve.fi',
    contracts: [
      { address: '0x99a58482BD75cbab83b27EC03CA68fF489b5788f', role: 'router', description: 'Router' },
      { address: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7', role: 'pool', description: '3pool (DAI/USDC/USDT)' },
    ],
  },
]
