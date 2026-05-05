import type { Action, ChainId } from '@txfence/core'
import { isCosmosChain } from './constants.js'

export type CosmosSerializedTransaction = {
  chain: ChainId
  txBytes: Uint8Array
  signers: string[]
}

// Full MsgSend construction requires cosmjs-types for Protobuf encoding.
// For now, if cosmosTransaction is provided on any action, it is passed through directly.
// Native MsgSend building will be completed when cosmjs-types is added as a dependency.
export async function buildCosmosTransaction(
  action: Action,
  chainId: ChainId,
  _rpcUrl: string,
  fromAddress: string,
): Promise<CosmosSerializedTransaction> {
  if (!isCosmosChain(chainId)) {
    throw new Error('chain not supported by Cosmos adapter: ' + chainId)
  }

  if (action.kind === 'swap' || action.kind === 'contract_call') {
    if (action.cosmosTransaction !== undefined) {
      // pre-built transaction bytes from builder
      return { chain: chainId, txBytes: action.cosmosTransaction, signers: [fromAddress] }
    }
    throw new Error(
      `${action.kind === 'swap' ? 'SwapAction' : 'ContractCallAction'} on Cosmos requires cosmosTransaction — ` +
      'build the transaction bytes using @cosmjs/stargate and pass them via cosmosTransaction field',
    )
  }

  // TransferAction
  if (action.cosmosTransaction !== undefined) {
    return { chain: chainId, txBytes: action.cosmosTransaction, signers: [fromAddress] }
  }

  throw new Error(
    'TransferAction on Cosmos requires cosmosTransaction until native MsgSend building is implemented — ' +
    'encode the transaction using @cosmjs/stargate and pass it via cosmosTransaction',
  )
}
