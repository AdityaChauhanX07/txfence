# @txfence/provenance

Cryptographically linked provenance records for txfence transactions.

## What this is

Every transaction gets a provenance record capturing: which agent submitted it,
which policy version evaluated it, what the simulation returned, who approved it,
and the final on-chain receipt. Records form a hash chain and a Merkle tree.

At any point you can:
- Prove a specific transaction was authorized under a specific policy
- Verify the chain has not been tampered with
- Generate a compact Merkle proof for any record

## Use case

Hand a compliance officer cryptographic proof that every transaction
followed your policy:

```typescript
import { createFileProvenanceChain } from '@txfence/provenance'

const chain = createFileProvenanceChain('./provenance.jsonl')

// Append a record after each pipeline execution
await chain.append({
  agentId: '0xAGENT',
  policyVersionId: getPolicyVersionId(policy),
  action,
  simulationResult,
  approvalDecision: 'not_required',
  outcome: { status: 'success', txHash: '0x...', confirmedAtBlock: 1000, gasUsed: '21000' },
})

// Verify the chain has not been tampered with
const result = await chain.verify()
console.log(result.valid)  // true if unmodified

// Generate a proof for a specific transaction
const proof = await chain.generateProof(entryHash)

// Verify the proof
console.log(chain.verifyProof(proof))  // true
```

## Tamper evidence

Hash chaining: each record includes the hash of the previous record.
Modifying any record invalidates all subsequent records.

Merkle tree: the root hash commits to all records. A Merkle proof proves
a record exists without revealing all other records.

## Known limitation

The chain file must be stored on tamper-evident infrastructure (S3 with
object lock, WORM storage) for strict compliance requirements.
The hash chain detects tampering but does not prevent it on a writable filesystem.

---

Full project README: https://github.com/AdityaChauhanX07/txfence

