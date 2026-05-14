// Standard binary Merkle tree over provenance record hashes.
// Leaves are entry hashes. Internal nodes are SHA-256(left || right).
// Odd number of leaves: duplicate the last leaf (standard padding).
//
// The Merkle root commits to the complete ordered set of entries.
// A Merkle proof is O(log n) hashes proving a leaf exists in the tree.

import { createHash } from 'node:crypto'
import type { MerkleProof } from './types.js'

function hashPair(left: string, right: string): string {
  return createHash('sha256').update(left + right).digest('hex')
}

export function buildMerkleTree(leafHashes: string[]): string[][] {
  if (leafHashes.length === 0) return [[]]

  const levels: string[][] = [leafHashes]
  let current = leafHashes

  while (current.length > 1) {
    const next: string[] = []
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i]!
      const right = current[i + 1] ?? current[i]!
      next.push(hashPair(left, right))
    }
    levels.push(next)
    current = next
  }

  return levels
}

export function getMerkleRoot(leafHashes: string[]): string {
  if (leafHashes.length === 0) return '0'.repeat(64)
  const tree = buildMerkleTree(leafHashes)
  return tree[tree.length - 1]?.[0] ?? '0'.repeat(64)
}

export function generateMerkleProof(
  leafHashes: string[],
  targetHash: string,
): MerkleProof | null {
  const leafIndex = leafHashes.indexOf(targetHash)
  if (leafIndex === -1) return null

  const tree = buildMerkleTree(leafHashes)
  const root = tree[tree.length - 1]?.[0] ?? '0'.repeat(64)
  const siblings: MerkleProof['siblings'] = []

  let index = leafIndex
  for (let level = 0; level < tree.length - 1; level++) {
    const levelNodes = tree[level]!
    const isLeftNode = index % 2 === 0
    const siblingIndex = isLeftNode ? index + 1 : index - 1
    const siblingHash = levelNodes[siblingIndex] ?? levelNodes[index]!

    siblings.push({
      hash: siblingHash,
      position: isLeftNode ? 'right' : 'left',
    })

    index = Math.floor(index / 2)
  }

  return {
    entryHash: targetHash,
    siblings,
    root,
    leafIndex,
  }
}

export function verifyMerkleProof(proof: MerkleProof): boolean {
  let current = proof.entryHash

  for (const sibling of proof.siblings) {
    if (sibling.position === 'right') {
      current = hashPair(current, sibling.hash)
    } else {
      current = hashPair(sibling.hash, current)
    }
  }

  return current === proof.root
}
