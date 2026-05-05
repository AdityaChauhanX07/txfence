import type { Action, ChainId, SimulationResult, SimulateOptions } from '@txfence/core'
import type { TenderlyConfig } from './simulate.js'

const TENDERLY_NETWORK_IDS: Partial<Record<ChainId, string>> = {
  ethereum: '1',
  arbitrum: '42161',
  optimism: '10',
  base: '8453',
}

const DEFAULT_GAS_BUFFER = 1.2

type TenderlySimResponse = {
  simulation: {
    status: boolean
    gas_used: number
    block_number: number
    error_message?: string
  }
  transaction?: {
    call_trace: unknown
    state_diff: unknown
    logs: unknown[]
  }
}

export async function simulateWithTenderly(
  action: Action,
  chainId: ChainId,
  tenderlyConfig: TenderlyConfig,
  options?: SimulateOptions,
): Promise<SimulationResult> {
  const networkId = TENDERLY_NETWORK_IDS[chainId]
  if (networkId === undefined) {
    throw new Error(`Tenderly simulation not supported for chain: ${chainId}`)
  }

  let to: string
  let value = '0'
  let input = '0x'

  if (action.kind === 'swap') {
    to = action.via
  } else if (action.kind === 'transfer') {
    to = action.to
    value = action.token.amount.toString()
  } else {
    to = action.contract
    if (action.value !== undefined) value = action.value.amount.toString()
    if (action.calldata !== undefined) input = action.calldata
  }

  const stateObjects: Record<string, { balance?: string; nonce?: number }> = {}
  if (options?.stateOverrides !== undefined) {
    for (const [addr, override] of Object.entries(options.stateOverrides)) {
      stateObjects[addr] = {
        ...(override.balance !== undefined ? { balance: '0x' + override.balance.toString(16) } : {}),
        ...(override.nonce !== undefined ? { nonce: override.nonce } : {}),
      }
    }
  }

  const url =
    `https://api.tenderly.co/api/v1/account/${tenderlyConfig.accountSlug}` +
    `/project/${tenderlyConfig.projectSlug}/simulate`

  const body: Record<string, unknown> = {
    network_id: networkId,
    from: '0x0000000000000000000000000000000000000001',
    to,
    input,
    value,
    save_if_fails: false,
    simulation_type: 'full',
  }
  if (Object.keys(stateObjects).length > 0) {
    body['state_objects'] = stateObjects
  }

  const failResult = (wouldRevert = false): SimulationResult => ({
    success: false,
    wouldRevert,
    chain: chainId,
    simulatedAtBlock: 0,
    gasEstimate: 0n,
    gasBufferApplied: 0,
    coverageLevel: 'none',
    caveats: ['state_may_diverge'],
    provider: 'tenderly',
  })

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': tenderlyConfig.accessKey,
      },
      body: JSON.stringify(body),
    })
  } catch {
    return failResult()
  }

  if (!response.ok) {
    return failResult()
  }

  const data = await response.json() as TenderlySimResponse
  const sim = data.simulation
  const wouldRevert = !sim.status
  const gasEstimate = BigInt(Math.ceil(sim.gas_used * DEFAULT_GAS_BUFFER))

  return {
    success: !wouldRevert,
    wouldRevert,
    ...(wouldRevert && sim.error_message !== undefined ? { revertReason: sim.error_message } : {}),
    chain: chainId,
    simulatedAtBlock: sim.block_number,
    gasEstimate,
    gasBufferApplied: DEFAULT_GAS_BUFFER,
    coverageLevel: 'deep',
    caveats: [],
    provider: 'tenderly',
    trace: {
      callTrace: data.transaction?.call_trace ?? null,
      stateDiff: data.transaction?.state_diff ?? null,
      logs: data.transaction?.logs ?? [],
      gasUsed: sim.gas_used,
    },
  }
}
