import { describe, it, expect } from 'vitest'
import { createRegistry, defaultRegistry } from './registry.js'
import { asset, protocol, maxSpend, listAssets, listProtocols } from './helpers.js'
import type { AssetDefinition, ProtocolDefinition } from './types.js'
import type { Policy } from '../types/policy.js'

describe('createRegistry — asset lookup', () => {
  it('finds USDC on ethereum', () => {
    const registry = createRegistry()
    const usdc = registry.getAsset('USDC', 'ethereum')
    expect(usdc).toBeDefined()
    expect(usdc?.decimals).toBe(6)
    expect(usdc?.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('is case-insensitive for symbol lookup', () => {
    const registry = createRegistry()
    const lower = registry.getAsset('usdc', 'ethereum')
    const upper = registry.getAsset('USDC', 'ethereum')
    expect(lower?.address).toBe(upper?.address)
  })

  it('returns undefined for unknown asset', () => {
    const registry = createRegistry()
    expect(registry.getAsset('SHIB', 'ethereum')).toBeUndefined()
  })

  it('throws from asset() for unknown asset', () => {
    const registry = createRegistry()
    expect(() => registry.asset('SHIB', 'ethereum')).toThrow('SHIB')
  })

  it('lists assets for a specific chain', () => {
    const registry = createRegistry()
    const ethereumAssets = registry.listAssets('ethereum')
    expect(ethereumAssets.every(a => a.chain === 'ethereum')).toBe(true)
    expect(ethereumAssets.length).toBeGreaterThan(0)
  })

  it('lists all assets when no chain filter', () => {
    const registry = createRegistry()
    const all = registry.listAssets()
    expect(all.length).toBeGreaterThan(10)
  })

  it('adds a custom asset and finds it', () => {
    const registry = createRegistry()
    registry.addAsset({
      symbol: 'MYTOKEN',
      chain: 'ethereum',
      address: '0x1234567890123456789012345678901234567890',
      decimals: 18,
    })
    const found = registry.getAsset('MYTOKEN', 'ethereum')
    expect(found?.address).toBe('0x1234567890123456789012345678901234567890')
  })

  it('replaces existing asset on addAsset', () => {
    const registry = createRegistry()
    const originalUsdc = registry.getAsset('USDC', 'ethereum')
    registry.addAsset({
      symbol: 'USDC',
      chain: 'ethereum',
      address: '0xNEWADDRESS00000000000000000000000000000',
      decimals: 6,
    })
    const updated = registry.getAsset('USDC', 'ethereum')
    expect(updated?.address).not.toBe(originalUsdc?.address)
  })
})

describe('createRegistry — protocol lookup', () => {
  it('finds uniswap-v3 on ethereum', () => {
    const registry = createRegistry()
    const proto = registry.getProtocol('uniswap-v3', 'ethereum')
    expect(proto).toBeDefined()
    expect(proto?.contracts.length).toBeGreaterThan(0)
    expect(proto?.contracts.some(c => c.role === 'router')).toBe(true)
  })

  it('returns undefined for unknown protocol', () => {
    const registry = createRegistry()
    expect(registry.getProtocol('unknown-dex', 'ethereum')).toBeUndefined()
  })

  it('throws from protocol() for unknown protocol', () => {
    const registry = createRegistry()
    expect(() => registry.protocol('unknown-dex', 'ethereum')).toThrow('unknown-dex')
  })

  it('returns ContractEntry[] for a single chain', () => {
    const registry = createRegistry()
    const entries = registry.protocol('uniswap-v3', 'ethereum')
    expect(Array.isArray(entries)).toBe(true)
    expect(entries.length).toBeGreaterThan(0)
    expect(entries.every(e => e.chain === 'ethereum')).toBe(true)
    expect(entries.every(e => typeof e.address === 'string')).toBe(true)
  })

  it('returns ContractEntry[] for multiple chains', () => {
    const registry = createRegistry()
    const entries = registry.protocol('uniswap-v3', ['ethereum', 'arbitrum'])
    const ethereumEntries = entries.filter(e => e.chain === 'ethereum')
    const arbitrumEntries = entries.filter(e => e.chain === 'arbitrum')
    expect(ethereumEntries.length).toBeGreaterThan(0)
    expect(arbitrumEntries.length).toBeGreaterThan(0)
  })

  it('throws when protocol missing on one chain in multi-chain request', () => {
    const registry = createRegistry()
    expect(() =>
      registry.protocol('uniswap-v3', ['ethereum', 'cosmoshub'])
    ).toThrow('cosmoshub')
  })

  it('adds custom protocol and finds it', () => {
    const registry = createRegistry()
    registry.addProtocol({
      id: 'my-dex',
      name: 'My DEX',
      chain: 'ethereum',
      contracts: [
        { address: '0xDEX0000000000000000000000000000000000001', role: 'router' },
      ],
    })
    const entries = registry.protocol('my-dex', 'ethereum')
    expect(entries[0]?.address).toBe('0xDEX0000000000000000000000000000000000001')
  })
})

describe('createRegistry — maxSpend helper', () => {
  it('resolves decimals from asset registry', () => {
    const registry = createRegistry()
    const amount = registry.maxSpend(1000n, 'USDC', 'ethereum')
    expect(amount.token).toBe('USDC')
    expect(amount.amount).toBe(1000n)
    expect(amount.decimals).toBe(6)
  })

  it('throws for unknown asset', () => {
    const registry = createRegistry()
    expect(() => registry.maxSpend(1000n, 'SHIB', 'ethereum')).toThrow('SHIB')
  })
})

describe('top-level helpers (defaultRegistry delegates)', () => {
  it('asset() resolves from default registry', () => {
    const usdc = asset('USDC', 'ethereum')
    expect(usdc.decimals).toBe(6)
  })

  it('protocol() resolves from default registry', () => {
    const entries = protocol('uniswap-v3', ['ethereum', 'arbitrum'])
    expect(entries.length).toBeGreaterThan(0)
  })

  it('maxSpend() resolves decimals', () => {
    const amount = maxSpend(5000n, 'USDC', 'ethereum')
    expect(amount.decimals).toBe(6)
    expect(amount.amount).toBe(5000n)
  })

  it('listAssets returns ethereum assets', () => {
    const assets = listAssets('ethereum')
    expect(assets.some(a => a.symbol === 'USDC')).toBe(true)
    expect(assets.some(a => a.symbol === 'WETH')).toBe(true)
  })

  it('listProtocols returns ethereum protocols', () => {
    const protos = listProtocols('ethereum')
    expect(protos.some(p => p.id === 'uniswap-v3')).toBe(true)
    expect(protos.some(p => p.id === 'aave-v3')).toBe(true)
  })
})

describe('policy integration — real-world usage', () => {
  it('builds a valid policy using registry helpers', () => {
    const policy: Policy = {
      chains: ['ethereum', 'arbitrum'],
      maxSpendPerTx: maxSpend(10_000n, 'USDC', 'ethereum'),
      allowedContracts: [
        ...protocol('uniswap-v3', ['ethereum', 'arbitrum']),
        ...protocol('aave-v3', ['ethereum']),
      ],
      requireSimulation: true,
      gasBufferMultiplier: 1.2,
      humanApprovalThreshold: maxSpend(50_000n, 'USDC', 'ethereum'),
      humanApprovalTimeoutMs: 30000,
      capLockMode: 'per-agent',
    }

    expect(policy.maxSpendPerTx.decimals).toBe(6)
    expect(policy.allowedContracts.length).toBeGreaterThan(0)
    const uniswapEth = policy.allowedContracts.find(
      c => c.chain === 'ethereum' &&
      c.address === '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    )
    expect(uniswapEth).toBeDefined()
  })

  it('createRegistry with empty arrays creates empty registry', () => {
    const registry = createRegistry([], [])
    expect(registry.listAssets()).toHaveLength(0)
    expect(registry.listProtocols()).toHaveLength(0)
  })
})

// Suppress unused import warnings — these are imported for type coverage
void defaultRegistry
const _assetDef: AssetDefinition | undefined = undefined
const _protoDef: ProtocolDefinition | undefined = undefined
void _assetDef
void _protoDef
