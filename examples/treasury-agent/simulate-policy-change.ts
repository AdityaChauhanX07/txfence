#!/usr/bin/env npx tsx
// Shows the blast radius of a policy change using txfence diff

import { diffPolicies, createTestActions } from '@txfence/core'
import { treasuryPolicy, proposedPolicy } from './policy.js'

async function main(): Promise<void> {
  console.log('\n=== Policy Diff: Current vs Proposed Treasury Policy ===\n')
  console.log('Current policy:  maxSpendPerTx = 10,000 USDC')
  console.log('Proposed policy: maxSpendPerTx = 5,000 USDC\n')

  // Generate test actions from the current policy
  const actions = createTestActions(treasuryPolicy)
  console.log(`Testing ${actions.length} auto-generated actions...\n`)

  const diff = diffPolicies({
    policyA: treasuryPolicy,
    policyB: proposedPolicy,
    actions,
  })

  console.log('=== Summary ===')
  console.log(`Total actions tested:        ${diff.summary.total}`)
  console.log(`Unchanged:                   ${diff.summary.unchanged}`)
  console.log(`Changed:                     ${diff.summary.changed}`)
  console.log(`  Newly allowed:             ${diff.summary.newlyAllowed}`)
  console.log(`  Newly rejected:            ${diff.summary.newlyRejected}`)
  console.log(`  Rejection reason changed:  ${diff.summary.rejectionReasonChanged}`)

  if (diff.summary.requiresSimulation > 0) {
    console.log(`\nNote: ${diff.summary.requiresSimulation} actions have simulation-dependent`)
    console.log('checks that were not evaluated (no simulationResult provided)')
  }

  if (diff.summary.changed === 0) {
    console.log('\nNo changes detected between the two policies.')
    return
  }

  console.log('\n=== Changed Actions ===\n')
  for (const result of diff.results.filter(r => r.changed)) {
    const direction = result.direction?.toUpperCase().replace(/_/g, ' ') ?? 'CHANGED'
    const action = result.action
    const actionDesc =
      action.kind === 'transfer'
        ? `Transfer ${Number(action.token.amount) / 1e6} USDC`
        : action.kind === 'swap'
        ? `Swap ${Number(action.from.amount) / 1e6} USDC → ${action.to} via ${action.via.slice(0, 10)}...`
        : `Contract call`

    console.log(`[${direction}] ${actionDesc}`)

    const aStatus = result.evaluationA.passed
      ? 'ALLOWED'
      : `REJECTED (${result.evaluationA.rejectionReason})`
    const bStatus = result.evaluationB.passed
      ? 'ALLOWED'
      : `REJECTED (${result.evaluationB.rejectionReason})`

    console.log(`  Current policy:  ${aStatus}`)
    console.log(`  Proposed policy: ${bStatus}`)

    if (result.changedChecks.length > 0) {
      console.log(`  Changed checks:  ${result.changedChecks.map(c => c.checkName).join(', ')}`)
    }
    console.log()
  }

  if (diff.summary.newlyRejected > 0) {
    console.log(`WARNING: ${diff.summary.newlyRejected} action(s) that currently pass`)
    console.log('will be REJECTED under the proposed policy.')
    console.log('Review these before deploying the policy change.\n')
  }
}

main().catch(console.error)
