import { describe, it, expect } from 'vitest'
import { simulateCosmosAction } from './simulate.js'
import { StargateClient } from '@cosmjs/stargate'

// process is a Node.js global available in the vitest/Node.js runtime
declare const process: { env: Record<string, string | undefined> }

const COSMOS_RPC = process.env['COSMOS_RPC_URL'] ?? 'https://rpc.cosmos.network'

describe.skipIf(!process.env['COSMOS_RPC_URL'])(
  'Cosmos integration — requires COSMOS_RPC_URL',
  () => {
    it('connects to a real Cosmos node', async () => {
      const client = await StargateClient.connect(COSMOS_RPC)
      const height = await client.getHeight()
      expect(typeof height).toBe('number')
      expect(height).toBeGreaterThan(0)
      client.disconnect()
    }, 15000)

    it('simulateCosmosAction returns a real block height', async () => {
      const action = {
        kind: 'transfer' as const,
        chain: 'cosmoshub' as const,
        token: { token: 'ATOM', amount: 1_000_000n, decimals: 6 },
        to: 'cosmos1qnk2n4nlkpw9xfqntladh74er2xa62wgas8vpy',
      }
      const result = await simulateCosmosAction(action, 'cosmoshub', COSMOS_RPC)
      expect(result.success).toBe(true)
      expect(result.simulatedAtBlock).toBeGreaterThan(0)
      expect(result.chain).toBe('cosmoshub')
      expect(result.gasEstimate).toBe(80000n)
    }, 15000)

    it('returns failure gracefully when RPC is unreachable', async () => {
      const action = {
        kind: 'transfer' as const,
        chain: 'cosmoshub' as const,
        token: { token: 'ATOM', amount: 1_000_000n, decimals: 6 },
        to: 'cosmos1qnk2n4nlkpw9xfqntladh74er2xa62wgas8vpy',
      }
      const result = await simulateCosmosAction(
        action, 'cosmoshub', 'http://127.0.0.1:19999',
      )
      expect(result.success).toBe(false)
      expect(result.coverageLevel).toBe('none')
    }, 10000)
  },
)
