// privateKeySigner is intended for development and testing only.
// For production use, implement the Signer interface with your own key management solution.

import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { SerializedTransaction, Signer } from '@txfence/core'
import { getViemChain } from './chains.js'

export function privateKeySigner(privateKey: `0x${string}`): Signer {
  const account = privateKeyToAccount(privateKey)
  return {
    address: account.address,
    sign: async (tx: SerializedTransaction): Promise<`0x${string}`> => {
      const chain = getViemChain(tx.chain)
      const client = createWalletClient({
        account,
        chain,
        transport: http(tx.rpcUrl),
      })
      const request = await client.prepareTransactionRequest({
        to: tx.to as `0x${string}`,
        value: tx.value,
        data: tx.data,
        gas: tx.gas,
      })
      const serialized = await client.signTransaction(request)
      return serialized
    },
  }
}
