import { describe, it, expect, vi, beforeEach } from 'vitest'
import { simulateCosmosAction } from './simulate.js'
import type { TransferAction, SwapAction, ContractCallAction } from '@txfence/core'

vi.mock('@cosmjs/stargate', () => ({
  StargateClient: {
    connect: vi.fn().mockResolvedValue({
      getHeight: vi.fn().mockResolvedValue(12345678),
      disconnect: vi.fn(),
    }),
  },
}))

import { StargateClient } from '@cosmjs/stargate'

const transferToCosmoshub: TransferAction = {
  kind: 'transfer',
  chain: 'cosmoshub',
  token: { token: 'ATOM', amount: 1_000_000n, decimals: 6 },
  to: 'cosmos1qnk2n4nlkpw9xfqntladh74er2xa62wgas8vpy',
}

const transferToOsmosis: TransferAction = {
  kind: 'transfer',
  chain: 'osmosis',
  token: { token: 'OSMO', amount: 1_000_000n, decimals: 6 },
  to: 'osmo1qnk2n4nlkpw9xfqntladh74er2xa62wgas8vpy',
}

const swapWithBytes: SwapAction = {
  kind: 'swap',
  chain: 'osmosis',
  from: { token: 'OSMO', amount: 1_000_000n, decimals: 6 },
  to: 'ATOM',
  via: 'osmosis-pool-1',
  maxSlippage: 50,
  cosmosTransaction: new Uint8Array([1, 2, 3, 4]),
}

const contractCallWithBytes: ContractCallAction = {
  kind: 'contract_call',
  chain: 'cosmoshub',
  contract: 'cosmos1contract',
  method: 'execute',
  args: [],
  cosmosTransaction: new Uint8Array([5, 6, 7, 8]),
}

describe('simulateCosmosAction — unit tests (mocked StargateClient)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a simulation result for TransferAction on cosmoshub', async () => {
    const result = await simulateCosmosAction(
      transferToCosmoshub, 'cosmoshub', 'http://mock-rpc:26657',
    )
    expect(result.success).toBe(true)
    expect(result.chain).toBe('cosmoshub')
    expect(result.simulatedAtBlock).toBe(12345678)
    expect(result.gasEstimate).toBe(80000n)
    expect(result.coverageLevel).toBe('partial')
    expect(result.caveats).toContain('state_may_diverge')
    expect(result.caveats).toContain('compute_budget_estimated')
  })

  it('returns a simulation result for TransferAction on osmosis', async () => {
    const result = await simulateCosmosAction(
      transferToOsmosis, 'osmosis', 'http://mock-rpc:26657',
    )
    expect(result.success).toBe(true)
    expect(result.chain).toBe('osmosis')
    expect(result.simulatedAtBlock).toBe(12345678)
  })

  it('returns simulation result for SwapAction with cosmosTransaction bytes', async () => {
    const result = await simulateCosmosAction(
      swapWithBytes, 'osmosis', 'http://mock-rpc:26657',
    )
    expect(result.success).toBe(true)
    expect(result.chain).toBe('osmosis')
  })

  it('returns simulation result for ContractCallAction with cosmosTransaction bytes', async () => {
    const result = await simulateCosmosAction(
      contractCallWithBytes, 'cosmoshub', 'http://mock-rpc:26657',
    )
    expect(result.success).toBe(true)
  })

  it('returns failure result when StargateClient throws', async () => {
    vi.mocked(StargateClient.connect).mockRejectedValueOnce(
      new Error('connection refused'),
    )
    const result = await simulateCosmosAction(
      transferToCosmoshub, 'cosmoshub', 'http://bad-rpc:26657',
    )
    expect(result.success).toBe(false)
    expect(result.coverageLevel).toBe('none')
  })

  it('throws for non-Cosmos chain', async () => {
    await expect(
      simulateCosmosAction(
        { kind: 'transfer', chain: 'ethereum', token: { token: 'ETH', amount: 1n, decimals: 18 }, to: '0x123' },
        'ethereum',
        'http://mock-rpc',
      ),
    ).rejects.toThrow('not supported by Cosmos adapter')
  })

  it('calls StargateClient.connect with the provided rpcUrl', async () => {
    const mockRpcUrl = 'http://custom-cosmos-rpc:26657'
    await simulateCosmosAction(transferToCosmoshub, 'cosmoshub', mockRpcUrl)
    expect(StargateClient.connect).toHaveBeenCalledWith(mockRpcUrl)
  })
})

describe('simulateCosmosAction — SwapAction without cosmosTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns failure when SwapAction has no cosmosTransaction', async () => {
    const swapNoBytes: SwapAction = {
      kind: 'swap',
      chain: 'osmosis',
      from: { token: 'OSMO', amount: 1_000_000n, decimals: 6 },
      to: 'ATOM',
      via: 'osmosis-pool-1',
      maxSlippage: 50,
    }
    const result = await simulateCosmosAction(swapNoBytes, 'osmosis', 'http://mock-rpc')
    expect(result.success).toBe(false)
    expect(result.coverageLevel).toBe('none')
  })
})
