import { Command } from 'commander'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { loadConfig } from '@txfence/mcp'
import {
  executeIntent,
  evaluateIntent,
  validateIntentGraph,
  formatExecutionFailureReason,
  bigintReplacer,
} from '@txfence/core'
import type { Intent, IntentStep } from '@txfence/core'
import { executeEvmAction } from '@txfence/evm'

// ── helpers ──────────────────────────────────────────────────────────────────

function reviveIntent(raw: Record<string, unknown>): Intent {
  const steps = (raw['steps'] as Record<string, unknown>[]).map(step => {
    const action = step['action'] as Record<string, unknown>
    if (action['kind'] === 'transfer') {
      const token = action['token'] as Record<string, unknown>
      if (typeof token['amount'] === 'string') token['amount'] = BigInt(token['amount'])
    }
    if (action['kind'] === 'swap') {
      const from = action['from'] as Record<string, unknown>
      if (typeof from['amount'] === 'string') from['amount'] = BigInt(from['amount'])
    }
    if (action['kind'] === 'contract_call' && action['value'] !== undefined) {
      const value = action['value'] as Record<string, unknown>
      if (typeof value['amount'] === 'string') value['amount'] = BigInt(value['amount'])
    }
    return step
  })

  const intentPolicy = raw['intentPolicy'] as Record<string, unknown> | undefined
  if (intentPolicy !== undefined) {
    const reviveTokenAmount = (field: string) => {
      const ta = intentPolicy[field] as Record<string, unknown> | undefined
      if (ta !== undefined && typeof ta['amount'] === 'string') {
        ta['amount'] = BigInt(ta['amount'])
      }
    }
    reviveTokenAmount('maxTotalGrossSpend')
    reviveTokenAmount('maxNetSpend')
    reviveTokenAmount('maxIntermediateExposure')
  }

  return {
    id: raw['id'] as string,
    ...(raw['label'] !== undefined ? { label: raw['label'] as string } : {}),
    steps: steps as IntentStep[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(intentPolicy !== undefined ? { intentPolicy: intentPolicy as any } : {}),
  }
}

// ── subcommands ───────────────────────────────────────────────────────────────

const validateCmd = new Command('validate')
  .description('Validate an intent file — check for cycles, missing dependencies, and policy violations')
  .requiredOption('--config <path>', 'path to txfence config')
  .requiredOption('--intent <path>', 'path to intent JSON file')

validateCmd.action(async (opts: Record<string, unknown>) => {
  try {
    const config = await loadConfig(resolve(opts['config'] as string))
    const intentRaw = JSON.parse(readFileSync(resolve(opts['intent'] as string), 'utf-8')) as Record<string, unknown>
    const intent = reviveIntent(intentRaw)

    console.log('\n=== Intent Validation ===\n')
    console.log(`Intent ID: ${intent.id}`)
    console.log(`Steps:     ${intent.steps.length}`)

    // Graph validation
    const graphResult = validateIntentGraph(intent)
    if (!graphResult.valid) {
      console.error(`\n[INVALID] Graph error: ${graphResult.detail}`)
      console.error(`Reason: ${graphResult.reason}`)
      process.exit(1)
    }
    console.log(`\nGraph:     VALID`)
    console.log(`Execution plan: ${graphResult.executionPlan.join(' → ')}`)

    // Policy evaluation
    const evalResult = evaluateIntent(intent, config.policy)
    if (!evalResult.passed) {
      console.error(`\n[REJECTED] Intent policy evaluation failed`)
      console.error(`Reason: ${evalResult.rejectionReason}`)
      if (evalResult.stepEvaluations.some(s => !s.evaluation.passed)) {
        console.error('\nFailed steps:')
        for (const step of evalResult.stepEvaluations.filter(s => !s.evaluation.passed)) {
          console.error(`  ${step.stepId}: ${step.evaluation.rejectionReason}`)
        }
      }
      process.exit(1)
    }

    console.log(`\nPolicy:    PASSED`)
    if (evalResult.intentPolicyEvaluation !== undefined) {
      const pos = evalResult.intentPolicyEvaluation.positionAnalysis
      console.log(`\nPosition analysis:`)
      console.log(`  Single token:        ${pos.isSingleToken}`)
      if (pos.dominantToken !== undefined) {
        console.log(`  Token:               ${pos.dominantToken}`)
      }
      console.log(`  Total gross outflow: ${pos.totalGrossOutflow}`)
      console.log(`  Max intermediate:    ${pos.maxIntermediateExposure}`)
    }

    console.log('\nIntent is valid and ready to execute.')
    process.exit(0)
  } catch (err) {
    console.error((err as Error).message)
    process.exit(1)
  }
})

const submitCmd = new Command('submit')
  .description('Execute an intent — runs all steps in dependency order')
  .requiredOption('--config <path>', 'path to txfence config')
  .requiredOption('--intent <path>', 'path to intent JSON file')
  .option('--dry-run', 'validate and evaluate without executing', false)
  .option('--json', 'output results as JSON')

submitCmd.action(async (opts: Record<string, unknown>) => {
  try {
    const config = await loadConfig(resolve(opts['config'] as string))
    const intentRaw = JSON.parse(readFileSync(resolve(opts['intent'] as string), 'utf-8')) as Record<string, unknown>
    const intent = reviveIntent(intentRaw)
    const isDryRun = opts['dryRun'] === true
    const isJson = opts['json'] === true

    console.log(`\n=== Intent Submit${isDryRun ? ' (dry run)' : ''} ===\n`)
    console.log(`Intent ID: ${intent.id}`)
    if (intent.label !== undefined) console.log(`Label:     ${intent.label}`)
    console.log(`Steps:     ${intent.steps.length}`)

    if (isDryRun) {
      const evalResult = evaluateIntent(intent, config.policy)
      if (isJson) {
        console.log(JSON.stringify(evalResult, bigintReplacer, 2))
      } else {
        console.log(`\nEvaluation: ${evalResult.passed ? 'PASSED' : 'REJECTED'}`)
        if (!evalResult.passed) {
          console.error(`Reason: ${evalResult.rejectionReason}`)
        }
        console.log(`Execution plan: ${evalResult.executionPlan.join(' → ')}`)
      }
      process.exit(evalResult.passed ? 0 : 1)
    }

    const executor = config.signer !== undefined
      ? (
          action: Parameters<typeof executeEvmAction>[0],
          chainId: Parameters<typeof executeEvmAction>[1],
          rpcUrl: Parameters<typeof executeEvmAction>[2],
          evaluation: Parameters<typeof executeEvmAction>[4],
          simulation: Parameters<typeof executeEvmAction>[5],
        ) => executeEvmAction(action, chainId, rpcUrl, config.signer!, evaluation, simulation)
      : undefined

    const result = await executeIntent(intent, config.policy, {
      adapters: config.adapters,
      rpcUrls: config.rpcUrls,
      ...(executor !== undefined ? { executor } : {}),
    })

    if (isJson) {
      console.log(JSON.stringify(result, bigintReplacer, 2))
    } else {
      console.log(`\nStatus:    ${result.status.toUpperCase()}`)
      console.log(`Duration:  ${result.durationMs}ms`)
      console.log('')

      if (result.completedStepIds.length > 0) {
        console.log(`Completed (${result.completedStepIds.length}):`)
        for (const stepId of result.completedStepIds) {
          const receipt = result.receipts[stepId]
          console.log(`  + ${stepId}: ${receipt?.txHash ?? 'no receipt'}`)
        }
      }

      if (result.failedStepIds.length > 0) {
        console.log(`\nFailed (${result.failedStepIds.length}):`)
        for (const stepId of result.failedStepIds) {
          const stepResult = result.stepResults.find(r => r.stepId === stepId)
          const reason = stepResult?.status === 'failed'
            ? formatExecutionFailureReason(stepResult.reason)
            : 'unknown'
          console.log(`  x ${stepId}: ${reason}`)
        }
      }

      if (result.skippedStepIds.length > 0) {
        console.log(`\nSkipped (${result.skippedStepIds.length}):`)
        for (const stepId of result.skippedStepIds) {
          console.log(`  - ${stepId}`)
        }
      }

      console.log('')
      const pos = result.positionAnalysis
      if (pos.totalGrossOutflow > 0n) {
        console.log(`Total gross outflow: ${pos.totalGrossOutflow}`)
      }
    }

    process.exit(
      result.status === 'completed' ? 0 :
      result.status === 'partial' ? 2 :
      1,
    )
  } catch (err) {
    console.error((err as Error).message)
    process.exit(1)
  }
})

// ── export ────────────────────────────────────────────────────────────────────

export function makeIntentCommand(): Command {
  const cmd = new Command('intent')
    .description('Intent execution commands')

  cmd.addCommand(validateCmd)
  cmd.addCommand(submitCmd)
  return cmd
}
