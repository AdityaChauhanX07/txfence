// privateKeySolanaSignerFromBytes is intended for development and testing only.
// For production use, implement your own signing flow using @solana/kit primitives.
//
// Note: this function is async because key derivation uses the Web Crypto API,
// which is inherently asynchronous. Callers should await it once and reuse the signer.

import { createKeyPairSignerFromPrivateKeyBytes, signBytes } from '@solana/kit'
import type { SolanaSerializedTransaction } from './build.js'

export type SolanaSigner = {
  address: string
  sign: (tx: SolanaSerializedTransaction) => Promise<Uint8Array>
}

export async function privateKeySolanaSignerFromBytes(secretKey: Uint8Array): Promise<SolanaSigner> {
  // createKeyPairSignerFromPrivateKeyBytes expects a 32-byte ed25519 private key scalar
  const keyPairSigner = await createKeyPairSignerFromPrivateKeyBytes(secretKey)

  return {
    address: keyPairSigner.address,

    sign: async (tx: SolanaSerializedTransaction): Promise<Uint8Array> => {
      // Sign the raw compiled message bytes using the ed25519 private key.
      // signBytes uses SubtleCrypto under the hood and returns 64 signature bytes.
      const sigBytes = await signBytes(keyPairSigner.keyPair.privateKey, tx.serializedMessage)

      // Assemble the Solana wire-format transaction:
      //   [compact-u16 signature count = 0x01] [64-byte signature] [compiled message bytes]
      const wireBytes = new Uint8Array(1 + 64 + tx.serializedMessage.length)
      wireBytes[0] = 1  // compact-u16 encoding of 1
      wireBytes.set(sigBytes, 1)
      wireBytes.set(tx.serializedMessage, 65)
      return wireBytes
    },
  }
}
