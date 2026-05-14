import { Command } from 'commander'
import { resolve } from 'node:path'
import { createFileProvenanceChain } from '@txfence/provenance'

type VerifyOpts = {
  chain: string
  json?: boolean
}

type ProofOpts = {
  chain: string
  hash: string
  json?: boolean
}

export function makeProvenanceCommand(): Command {
  const cmd = new Command('provenance').description(
    'Provenance chain commands — verify tamper-evident audit trails',
  )

  const verifyCmd = new Command('verify')
    .description(
      'Verify a provenance chain file — checks hash chain integrity and detects tampering',
    )
    .requiredOption('--chain <path>', 'path to provenance chain JSONL file')
    .option('--json', 'output results as JSON')

  verifyCmd.action(async (opts: VerifyOpts) => {
    try {
      const chain = createFileProvenanceChain(resolve(opts.chain))
      const result = await chain.verify()

      if (opts.json === true) {
        console.log(JSON.stringify(result, null, 2))
        process.exit(result.valid ? 0 : 1)
      }

      console.log('\n=== Provenance Chain Verification ===\n')
      console.log(`File:         ${opts.chain}`)
      console.log(`Records:      ${result.entryCount}`)
      console.log(`Valid:        ${result.valid ? 'YES ✓' : 'NO ✗'}`)
      console.log(`Merkle root:  ${result.merkleRoot.slice(0, 16)}...`)
      console.log(`Verified at:  ${new Date(result.verifiedAt).toISOString()}`)

      if (result.entryCount > 0) {
        console.log(`First hash:   ${result.firstHash.slice(0, 16)}...`)
        console.log(`Last hash:    ${result.lastHash.slice(0, 16)}...`)
      }

      if (result.violations.length > 0) {
        console.log(`\nViolations (${result.violations.length}):`)
        for (const v of result.violations) {
          console.log(`  [${v.violation.toUpperCase()}] ${v.entryId}`)
          console.log(`    ${v.details}`)
        }
        console.log(
          '\nWARNING: This chain has been tampered with or corrupted.',
        )
        console.log('Do not rely on this chain for compliance purposes.')
      } else if (result.entryCount > 0) {
        console.log('\nAll records verified. Chain integrity confirmed.')
      } else {
        console.log('\nEmpty chain.')
      }

      process.exit(result.valid ? 0 : 1)
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

  const proofCmd = new Command('proof')
    .description('Generate a Merkle proof for a specific provenance record')
    .requiredOption('--chain <path>', 'path to provenance chain JSONL file')
    .requiredOption('--hash <entryHash>', 'entry hash to generate proof for')
    .option('--json', 'output proof as JSON')

  proofCmd.action(async (opts: ProofOpts) => {
    try {
      const chain = createFileProvenanceChain(resolve(opts.chain))
      const proof = await chain.generateProof(opts.hash)

      if (proof === null) {
        console.error(`Entry hash not found in chain: ${opts.hash}`)
        process.exit(1)
      }

      if (opts.json === true) {
        console.log(JSON.stringify(proof, null, 2))
        process.exit(0)
      }

      console.log('\n=== Merkle Proof ===\n')
      console.log(`Entry hash:   ${proof.entryHash}`)
      console.log(`Merkle root:  ${proof.root}`)
      console.log(`Leaf index:   ${proof.leafIndex}`)
      console.log(`Proof depth:  ${proof.siblings.length} sibling(s)`)
      console.log('\nSiblings:')
      for (let i = 0; i < proof.siblings.length; i++) {
        const s = proof.siblings[i]!
        console.log(`  [${i}] ${s.position.padEnd(5)} ${s.hash.slice(0, 16)}...`)
      }
      console.log('\nTo verify this proof:')
      console.log(`  txfence provenance verify --chain ${opts.chain}`)
      console.log('\nProof JSON (for external verification):')
      console.log(JSON.stringify(proof))

      process.exit(0)
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  })

  cmd.addCommand(verifyCmd)
  cmd.addCommand(proofCmd)
  return cmd
}
