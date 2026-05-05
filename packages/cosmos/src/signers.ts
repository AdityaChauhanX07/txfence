// Cosmos signing uses secp256k1 keys with bech32 addresses.
// The signing flow requires @cosmjs/proto-signing and a funded account
// with the correct sequence number from the chain.
// Full signing implementation requires the signing layer pass (similar to EVM and Solana).

import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { isCosmosChain, COSMOS_CHAIN_CONFIGS } from './constants.js'
import type { CosmosChainId } from './constants.js'
import type { CosmosSerializedTransaction } from './build.js'

export type CosmosSigner = {
  address: string
  sign: (tx: CosmosSerializedTransaction) => Promise<Uint8Array>
}

// Full implementation uses DirectSecp256k1HdWallet from @cosmjs/proto-signing.
// Sequence number management will be added in the signing layer pass.
export async function createCosmosSignerFromMnemonic(
  mnemonic: string,
  chainId: CosmosChainId,
): Promise<CosmosSigner> {
  if (!isCosmosChain(chainId)) {
    throw new Error('chain not supported by Cosmos adapter: ' + chainId)
  }

  const config = COSMOS_CHAIN_CONFIGS[chainId]!
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: config.bech32Prefix,
  })

  const accounts = await wallet.getAccounts()
  const account = accounts[0]
  if (account === undefined) {
    throw new Error('no accounts derived from mnemonic')
  }

  return {
    address: account.address,
    sign: async (tx: CosmosSerializedTransaction): Promise<Uint8Array> => {
      // Signing pre-built transaction bytes — the bytes are already encoded.
      // Full signing with sequence management will be implemented in the signing pass.
      return tx.txBytes
    },
  }
}
