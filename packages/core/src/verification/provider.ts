import type { ContractEntry } from '../types/policy.js'

export type MetadataVerificationResult =
  | { verified: true }
  | { verified: false; reason: 'bytecode_hash_mismatch' | 'owner_address_mismatch' | 'contract_entry_expired' }

export type MetadataVerifier = {
  verifyContract: (entry: ContractEntry) => Promise<MetadataVerificationResult>
}
