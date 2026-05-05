import { describe, it, expect } from 'vitest'
import { buildSolanaTransaction } from './build.js'
import type { SwapAction, ContractCallAction, TransferAction } from '@txfence/core'

const DUMMY_RPC = 'http://127.0.0.1:8899'
const DUMMY_FROM = 'DummyFromAddressNotUsedInPrebuiltPaths11111'

describe('buildSolanaTransaction — SwapAction', () => {
  it('throws when solanaTransaction is not provided', async () => {
    const action: SwapAction = {
      kind: 'swap',
      chain: 'solana',
      from: { token: 'SOL', amount: 1_000_000n, decimals: 9 },
      to: 'USDC',
      via: 'Jupiter',
      maxSlippage: 50,
    }
    await expect(
      buildSolanaTransaction(action, 'solana', DUMMY_RPC, DUMMY_FROM),
    ).rejects.toThrow('solanaTransaction')
  })

  it('returns the pre-built transaction bytes when solanaTransaction is provided', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const action: SwapAction = {
      kind: 'swap',
      chain: 'solana',
      from: { token: 'SOL', amount: 1_000_000n, decimals: 9 },
      to: 'USDC',
      via: 'Jupiter',
      maxSlippage: 50,
      solanaTransaction: bytes,
    }
    const result = await buildSolanaTransaction(action, 'solana', DUMMY_RPC, DUMMY_FROM)
    expect(result.serializedMessage).toEqual(bytes)
    expect(result.chain).toBe('solana')
  })
})

describe('buildSolanaTransaction — ContractCallAction', () => {
  it('throws when neither solanaTransaction nor solanaData+solanaAccounts provided', async () => {
    const action: ContractCallAction = {
      kind: 'contract_call',
      chain: 'solana',
      contract: 'SomeProgramAddress111111111111111111111111111',
      method: 'someMethod',
      args: [],
    }
    await expect(
      buildSolanaTransaction(action, 'solana', DUMMY_RPC, DUMMY_FROM),
    ).rejects.toThrow('solanaTransaction')
  })

  it('returns pre-built transaction bytes when solanaTransaction is provided', async () => {
    const bytes = new Uint8Array([5, 6, 7, 8])
    const action: ContractCallAction = {
      kind: 'contract_call',
      chain: 'solana',
      contract: 'SomeProgramAddress111111111111111111111111111',
      method: 'someMethod',
      args: [],
      solanaTransaction: bytes,
    }
    const result = await buildSolanaTransaction(action, 'solana', DUMMY_RPC, DUMMY_FROM)
    expect(result.serializedMessage).toEqual(bytes)
    expect(result.chain).toBe('solana')
  })
})

describe('buildSolanaTransaction — TransferAction', () => {
  it('throws when chain is not solana', async () => {
    const action: TransferAction = {
      kind: 'transfer',
      chain: 'ethereum',
      token: { token: 'ETH', amount: 1n * 10n ** 18n, decimals: 18 },
      to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    }
    await expect(
      buildSolanaTransaction(action, 'ethereum', DUMMY_RPC, DUMMY_FROM),
    ).rejects.toThrow('not supported by Solana adapter')
  })
})
