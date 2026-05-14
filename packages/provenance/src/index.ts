export type {
  ProvenanceRecord,
  ProvenanceRecordInput,
  ProvenanceOutcome,
  ProvenanceFilter,
  ProvenanceChain,
  MerkleProof,
  ChainViolation,
  ProvenanceVerificationResult,
} from './types.js'

export { createMemoryProvenanceChain } from './memory.js'
export { createFileProvenanceChain } from './file.js'
export { computeEntryHash, GENESIS_HASH } from './hash.js'
export {
  buildMerkleTree,
  getMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
} from './merkle.js'
