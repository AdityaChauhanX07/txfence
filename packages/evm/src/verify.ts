import { createPublicClient, http, keccak256 } from 'viem'
import type { MetadataVerifier, MetadataVerificationResult } from '@txfence/core'
import type { ContractEntry } from '@txfence/core'
import { getViemChain } from './chains.js'

export function createEvmMetadataVerifier(rpcUrls: Partial<Record<string, string>>): MetadataVerifier {
  return {
    async verifyContract(entry: ContractEntry): Promise<MetadataVerificationResult> {
      const rpcUrl = rpcUrls[entry.chain]
      if (rpcUrl === undefined) throw new Error('no rpcUrl for chain: ' + entry.chain)

      const chain = getViemChain(entry.chain)
      const client = createPublicClient({ chain, transport: http(rpcUrl) })

      if (entry.bytecodeHash !== undefined) {
        const bytecode = await client.getBytecode({ address: entry.address as `0x${string}` })
        if (bytecode === undefined || bytecode === '0x') {
          // contract has no bytecode — may have self-destructed
          return { verified: false, reason: 'bytecode_hash_mismatch' }
        }
        const hash = keccak256(bytecode)
        if (hash !== entry.bytecodeHash) {
          return { verified: false, reason: 'bytecode_hash_mismatch' }
        }
      }

      if (entry.ownerAddress !== undefined) {
        try {
          const result = await client.readContract({
            address: entry.address as `0x${string}`,
            abi: [{ name: 'owner', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }] as const,
            functionName: 'owner',
          })
          if ((result as string).toLowerCase() !== entry.ownerAddress.toLowerCase()) {
            return { verified: false, reason: 'owner_address_mismatch' }
          }
        } catch {
          // contract does not implement owner() — skipping owner check
        }
      }

      return { verified: true }
    },
  }
}
