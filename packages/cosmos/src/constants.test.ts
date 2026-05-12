import { describe, it, expect } from 'vitest'
import { isCosmosChain, COSMOS_CHAIN_CONFIGS, COSMOS_CHAIN_IDS } from './constants.js'

describe('isCosmosChain', () => {
  it('returns true for cosmoshub', () => {
    expect(isCosmosChain('cosmoshub')).toBe(true)
  })

  it('returns true for osmosis', () => {
    expect(isCosmosChain('osmosis')).toBe(true)
  })

  it('returns false for ethereum', () => {
    expect(isCosmosChain('ethereum')).toBe(false)
  })

  it('returns false for solana', () => {
    expect(isCosmosChain('solana')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isCosmosChain('')).toBe(false)
  })
})

describe('COSMOS_CHAIN_CONFIGS', () => {
  it('has correct config for cosmoshub', () => {
    const config = COSMOS_CHAIN_CONFIGS['cosmoshub']
    expect(config.chainId).toBe('cosmoshub-4')
    expect(config.denom).toBe('uatom')
    expect(config.bech32Prefix).toBe('cosmos')
    expect(config.gasPrice).toContain('uatom')
  })

  it('has correct config for osmosis', () => {
    const config = COSMOS_CHAIN_CONFIGS['osmosis']
    expect(config.chainId).toBe('osmosis-1')
    expect(config.denom).toBe('uosmo')
    expect(config.bech32Prefix).toBe('osmo')
    expect(config.gasPrice).toContain('uosmo')
  })

  it('covers all COSMOS_CHAIN_IDS', () => {
    for (const chainId of COSMOS_CHAIN_IDS) {
      expect(COSMOS_CHAIN_CONFIGS[chainId]).toBeDefined()
      expect(COSMOS_CHAIN_CONFIGS[chainId].chainId).toBeTruthy()
      expect(COSMOS_CHAIN_CONFIGS[chainId].denom).toBeTruthy()
      expect(COSMOS_CHAIN_CONFIGS[chainId].bech32Prefix).toBeTruthy()
    }
  })
})
