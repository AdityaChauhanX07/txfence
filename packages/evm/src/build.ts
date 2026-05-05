import { getAddress } from 'viem'
import type { Action, SerializedTransaction, ChainId } from '@txfence/core'
import { getViemChain } from './chains.js'

export async function buildEvmTransaction(
  action: Action,
  chainId: ChainId,
  rpcUrl: string,
  gasEstimate: bigint,
  gasBufferMultiplier: number,
  _fromAddress: `0x${string}`,
): Promise<SerializedTransaction> {
  const chain = getViemChain(chainId)
  const gas = BigInt(Math.ceil(Number(gasEstimate) * gasBufferMultiplier))

  let to: string
  let value: bigint
  let data: `0x${string}`

  if (action.kind === 'swap') {
    to = getAddress(action.via)
    value = 0n
    data = action.calldata ?? '0x'
  } else if (action.kind === 'transfer') {
    to = getAddress(action.to)
    value = action.token.amount
    data = '0x'
  } else {
    to = getAddress(action.contract)
    value = action.value?.amount ?? 0n
    data = action.calldata ?? '0x'
  }

  return { chain: chainId, to, value, data, gas, chainId: chain.id, rpcUrl }
}
