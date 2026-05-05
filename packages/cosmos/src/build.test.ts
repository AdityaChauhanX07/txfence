import { describe, it, expect } from 'vitest'
import { buildCosmosTransaction } from './build.js'
import { isCosmosChain } from './constants.js'
import type { SwapAction, ContractCallAction, TransferAction } from '@txfence/core'

const DUMMY_RPC = 'http://127.0.0.1:26657'
const DUMMY_FROM = 'cosmos1qnk2n4nlkpw9xfqntladh74er2xa62wgas8vpy'

// ── SwapAction ────────────────────────────────────────────────────────────────

describe('buildCosmosTransaction -- SwapAction', () => {
  it('throws when cosmosTransaction is not provided', async () => {
    const action: SwapAction = {
      kind: 'swap',
      chain: 'osmosis',
      from: { token: 'OSMO', amount: 1000000n, decimals: 6 },
      to: 'ATOM',
      via: 'osmosis-pool-1',
      maxSlippage: 50,
    }
    await expect(buildCosmosTransaction(action, 'osmosis', DUMMY_RPC, DUMMY_FROM))
      .rejects.toThrow('cosmosTransaction')
  })

  it('returns pre-built bytes when cosmosTransaction is provided', async () => {
    const txBytes = new Uint8Array([1, 2, 3, 4])
    const action: SwapAction = {
      kind: 'swap',
      chain: 'osmosis',
      from: { token: 'OSMO', amount: 1000000n, decimals: 6 },
      to: 'ATOM',
      via: 'osmosis-pool-1',
      maxSlippage: 50,
      cosmosTransaction: txBytes,
    }
    const result = await buildCosmosTransaction(action, 'osmosis', DUMMY_RPC, DUMMY_FROM)
    expect(result.txBytes).toEqual(txBytes)
    expect(result.chain).toBe('osmosis')
  })
})

// ── ContractCallAction ────────────────────────────────────────────────────────

describe('buildCosmosTransaction -- ContractCallAction', () => {
  it('throws when cosmosTransaction is not provided', async () => {
    const action: ContractCallAction = {
      kind: 'contract_call',
      chain: 'cosmoshub',
      contract: 'cosmos1contract',
      method: 'execute',
      args: [],
    }
    await expect(buildCosmosTransaction(action, 'cosmoshub', DUMMY_RPC, DUMMY_FROM))
      .rejects.toThrow('cosmosTransaction')
  })

  it('returns pre-built bytes when cosmosTransaction is provided', async () => {
    const txBytes = new Uint8Array([5, 6, 7, 8])
    const action: ContractCallAction = {
      kind: 'contract_call',
      chain: 'cosmoshub',
      contract: 'cosmos1contract',
      method: 'execute',
      args: [],
      cosmosTransaction: txBytes,
    }
    const result = await buildCosmosTransaction(action, 'cosmoshub', DUMMY_RPC, DUMMY_FROM)
    expect(result.txBytes).toEqual(txBytes)
  })
})

// ── TransferAction ────────────────────────────────────────────────────────────

describe('buildCosmosTransaction -- TransferAction', () => {
  it('throws when chain is not cosmos', async () => {
    const action: TransferAction = {
      kind: 'transfer',
      chain: 'ethereum',
      token: { token: 'ETH', amount: 1n, decimals: 18 },
      to: '0x123',
    }
    await expect(buildCosmosTransaction(action, 'ethereum', DUMMY_RPC, DUMMY_FROM))
      .rejects.toThrow('not supported by Cosmos adapter')
  })

  it('returns pre-built bytes when cosmosTransaction is provided on TransferAction', async () => {
    const txBytes = new Uint8Array([9, 10, 11, 12])
    const action: TransferAction = {
      kind: 'transfer',
      chain: 'cosmoshub',
      token: { token: 'ATOM', amount: 1000000n, decimals: 6 },
      to: 'cosmos1recipient',
      cosmosTransaction: txBytes,
    }
    const result = await buildCosmosTransaction(action, 'cosmoshub', DUMMY_RPC, DUMMY_FROM)
    expect(result.txBytes).toEqual(txBytes)
  })
})

// ── isCosmosChain ─────────────────────────────────────────────────────────────

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
})
