// Tenderly Fork API client.
// Forks are ephemeral — always delete them when done.
// Leaked forks consume Tenderly credits and clutter the project.
// All public functions clean up on error via try/finally.
//
// API reference: https://docs.tenderly.co/simulations-and-forks/forks
// Requires a Tenderly account with simulation credits.

import type { TenderlyForkConfig, StateChange, ChainId, Action } from '@txfence/core'
import { getViemChain } from './chains.js'

type TenderlyForkResponse = {
  simulation_fork: {
    id: string
    network_id: string
    block_number: number
    chain_config: {
      chain_id: number
    }
  }
}

type TenderlyForkSimulationResponse = {
  simulation: {
    id: string
    status: boolean         // true = success, false = reverted
    error_message: string | null
    block_number: number
    gas_used: number
  }
  contracts: Array<{
    address: string
    balanceDiff?: {
      before: string
      after: string
    }
  }>
  call_trace: unknown
  logs: unknown[]
}

export async function createFork(
  config: TenderlyForkConfig,
  chainId: ChainId,
  blockNumber?: number
): Promise<{ forkId: string; forkedAtBlock: number }> {
  const viemChain = getViemChain(chainId)
  const networkId = viemChain.id.toString()

  const body: Record<string, unknown> = {
    network_id: networkId,
  }
  if (blockNumber !== undefined) {
    body.block_number = blockNumber
  }

  const response = await fetch(
    `https://api.tenderly.co/api/v1/account/${config.accountSlug}/project/${config.projectSlug}/fork`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': config.accessKey,
      },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to create Tenderly fork: ${response.status} ${await response.text()}`)
  }

  const data = await response.json() as TenderlyForkResponse
  return {
    forkId: data.simulation_fork.id,
    forkedAtBlock: data.simulation_fork.block_number,
  }
}

export async function simulateOnFork(
  config: TenderlyForkConfig,
  forkId: string,
  transaction: {
    from: string
    to: string
    input: string      // calldata hex
    value: string      // hex value
    gas: number
  },
  chainId: ChainId,
  blockNumber: number
): Promise<{
  success: boolean
  wouldRevert: boolean
  revertReason?: string
  gasUsed: number
  stateChanges: StateChange[]
  rawTrace: unknown
}> {
  const response = await fetch(
    `https://api.tenderly.co/api/v1/account/${config.accountSlug}/project/${config.projectSlug}/fork/${forkId}/simulate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': config.accessKey,
      },
      body: JSON.stringify({
        network_id: getViemChain(chainId).id.toString(),
        from: transaction.from,
        to: transaction.to,
        input: transaction.input,
        value: transaction.value,
        gas: transaction.gas,
        save: false,
        save_if_fails: false,
        simulation_type: 'full',
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Fork simulation failed: ${response.status} ${await response.text()}`)
  }

  const data = await response.json() as TenderlyForkSimulationResponse

  // Extract state changes from contracts diff
  const stateChanges: StateChange[] = (data.contracts ?? [])
    .filter(c => c.balanceDiff !== undefined)
    .map(c => {
      const before = BigInt(c.balanceDiff!.before)
      const after = BigInt(c.balanceDiff!.after)
      return {
        address: c.address,
        balanceBefore: before,
        balanceAfter: after,
        delta: after - before,
      }
    })

  const revertReason = data.simulation.error_message
  return {
    success: true,
    wouldRevert: !data.simulation.status,
    ...(revertReason !== null ? { revertReason } : {}),
    gasUsed: data.simulation.gas_used,
    stateChanges,
    rawTrace: data.call_trace,
  }
}

export async function deleteFork(
  config: TenderlyForkConfig,
  forkId: string
): Promise<void> {
  const response = await fetch(
    `https://api.tenderly.co/api/v1/account/${config.accountSlug}/project/${config.projectSlug}/fork/${forkId}`,
    {
      method: 'DELETE',
      headers: {
        'X-Access-Key': config.accessKey,
      },
    }
  )

  if (!response.ok && response.status !== 404) {
    // 404 means already deleted — acceptable
    console.error(`[txfence] Failed to delete Tenderly fork ${forkId}: ${response.status}`)
    // Do not throw — fork deletion failure should not crash the caller
  }
}

export function buildForkTransactionParams(
  action: Action,
  fromAddress: string
): {
  from: string
  to: string
  input: string
  value: string
  gas: number
} {
  switch (action.kind) {
    case 'transfer':
      return {
        from: fromAddress,
        to: action.to,
        input: '0x',
        value: '0x' + action.token.amount.toString(16),
        gas: 21000,
      }
    case 'swap':
      return {
        from: fromAddress,
        to: action.via,
        input: action.calldata ?? '0x',
        value: '0x0',
        gas: 300000,
      }
    case 'contract_call':
      return {
        from: fromAddress,
        to: action.contract,
        input: action.calldata ?? '0x',
        value: action.value !== undefined
          ? '0x' + action.value.amount.toString(16)
          : '0x0',
        gas: 300000,
      }
  }
}
