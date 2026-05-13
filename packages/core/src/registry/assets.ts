// Built-in asset registry.
// Sources: official token documentation, CoinGecko, chain explorers.
// Addresses are checksummed. Verify before use in production.
// Submit a PR to add missing assets: github.com/AdityaChauhanX07/txfence

import type { AssetDefinition } from './types.js'

export const BUILT_IN_ASSETS: AssetDefinition[] = [

  // ── Ethereum ─────────────────────────────────────────────────────────────
  {
    symbol: 'USDC',
    chain: 'ethereum',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    coingeckoId: 'usd-coin',
  },
  {
    symbol: 'USDT',
    chain: 'ethereum',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    coingeckoId: 'tether',
  },
  {
    symbol: 'DAI',
    chain: 'ethereum',
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
    coingeckoId: 'dai',
  },
  {
    symbol: 'WETH',
    chain: 'ethereum',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
    coingeckoId: 'weth',
  },
  {
    symbol: 'WBTC',
    chain: 'ethereum',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
    coingeckoId: 'wrapped-bitcoin',
  },
  {
    symbol: 'stETH',
    chain: 'ethereum',
    address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    decimals: 18,
    coingeckoId: 'staked-ether',
  },

  // ── Arbitrum ──────────────────────────────────────────────────────────────
  {
    symbol: 'USDC',
    chain: 'arbitrum',
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
    coingeckoId: 'usd-coin',
  },
  {
    symbol: 'USDT',
    chain: 'arbitrum',
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    decimals: 6,
    coingeckoId: 'tether',
  },
  {
    symbol: 'DAI',
    chain: 'arbitrum',
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    decimals: 18,
    coingeckoId: 'dai',
  },
  {
    symbol: 'WETH',
    chain: 'arbitrum',
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    decimals: 18,
    coingeckoId: 'weth',
  },
  {
    symbol: 'WBTC',
    chain: 'arbitrum',
    address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    decimals: 8,
    coingeckoId: 'wrapped-bitcoin',
  },

  // ── Optimism ──────────────────────────────────────────────────────────────
  {
    symbol: 'USDC',
    chain: 'optimism',
    address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    decimals: 6,
    coingeckoId: 'usd-coin',
  },
  {
    symbol: 'USDT',
    chain: 'optimism',
    address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    decimals: 6,
    coingeckoId: 'tether',
  },
  {
    symbol: 'DAI',
    chain: 'optimism',
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    decimals: 18,
    coingeckoId: 'dai',
  },
  {
    symbol: 'WETH',
    chain: 'optimism',
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    coingeckoId: 'weth',
  },

  // ── Base ──────────────────────────────────────────────────────────────────
  {
    symbol: 'USDC',
    chain: 'base',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    coingeckoId: 'usd-coin',
  },
  {
    symbol: 'DAI',
    chain: 'base',
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    decimals: 18,
    coingeckoId: 'dai',
  },
  {
    symbol: 'WETH',
    chain: 'base',
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    coingeckoId: 'weth',
  },

  // ── Cosmos Hub ────────────────────────────────────────────────────────────
  {
    symbol: 'ATOM',
    chain: 'cosmoshub',
    address: 'uatom',
    decimals: 6,
    coingeckoId: 'cosmos',
  },

  // ── Osmosis ───────────────────────────────────────────────────────────────
  {
    symbol: 'OSMO',
    chain: 'osmosis',
    address: 'uosmo',
    decimals: 6,
    coingeckoId: 'osmosis',
  },
  {
    symbol: 'ATOM',
    chain: 'osmosis',
    address: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
    decimals: 6,
    coingeckoId: 'cosmos',
  },
]
