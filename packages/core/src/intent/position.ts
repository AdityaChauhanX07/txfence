import type { Action } from '../types/action.js'
import type {
  Intent,
  IntentStep,
  PositionChange,
  StepPositionSnapshot,
  IntentPositionAnalysis,
} from './types.js'
import type { ChainId } from '../types/policy.js'

export function getActionPositionChanges(action: Action): PositionChange[] {
  switch (action.kind) {
    case 'transfer':
      return [{ token: action.token.token, amount: -action.token.amount, chain: action.chain }]

    case 'swap':
      // Swap inflow (received token) is unknown at evaluation time.
      // Position analysis tracks outflows only for swap actions.
      // Post-execution analysis can be extended to include actual received amounts.
      return [{ token: action.from.token, amount: -action.from.amount, chain: action.chain }]

    case 'contract_call':
      // Contract calls without a value field have unknown position changes.
      // The call may transfer tokens internally but we cannot know without execution.
      return action.value !== undefined
        ? [{ token: action.value.token, amount: -action.value.amount, chain: action.chain }]
        : []
  }
}

export function mergePositionChanges(
  existing: PositionChange[],
  newChanges: PositionChange[],
): PositionChange[] {
  const merged = new Map<string, PositionChange>()
  const key = (p: PositionChange): string => `${p.token}:${p.chain}`

  for (const change of [...existing, ...newChanges]) {
    const k = key(change)
    const current = merged.get(k)
    if (current !== undefined) {
      merged.set(k, { ...current, amount: current.amount + change.amount })
    } else {
      merged.set(k, { ...change })
    }
  }

  return [...merged.values()]
}

export function isSingleTokenIntent(steps: IntentStep[]): boolean {
  const tokens = new Set<string>()
  for (const step of steps) {
    const changes = getActionPositionChanges(step.action)
    for (const change of changes) {
      if (change.amount < 0n) {
        tokens.add(`${change.token}:${change.chain}`)
      }
    }
  }
  return tokens.size <= 1
}

export function getDominantToken(steps: IntentStep[]): string | undefined {
  const tokens = new Set<string>()
  const tokenNames = new Set<string>()
  for (const step of steps) {
    const changes = getActionPositionChanges(step.action)
    for (const change of changes) {
      if (change.amount < 0n) {
        tokens.add(`${change.token}:${change.chain}`)
        tokenNames.add(change.token)
      }
    }
  }
  if (tokens.size === 1) return [...tokenNames][0]
  return undefined
}

export function analyzeIntentPosition(
  steps: IntentStep[],
  executionPlan: string[],
): IntentPositionAnalysis {
  const stepMap = new Map(steps.map(s => [s.id, s]))
  const snapshots: StepPositionSnapshot[] = []
  let cumulativePosition: PositionChange[] = []
  let totalGrossOutflow = 0n
  let maxIntermediateExposure = 0n

  for (const stepId of executionPlan) {
    const step = stepMap.get(stepId)
    if (step === undefined) continue

    const changes = getActionPositionChanges(step.action)
    cumulativePosition = mergePositionChanges(cumulativePosition, changes)

    const stepOutflow = changes
      .filter(c => c.amount < 0n)
      .reduce((sum, c) => sum + (-c.amount), 0n)
    totalGrossOutflow += stepOutflow

    const currentExposure = cumulativePosition
      .reduce((sum, c) => sum + (c.amount < 0n ? -c.amount : c.amount), 0n)
    if (currentExposure > maxIntermediateExposure) {
      maxIntermediateExposure = currentExposure
    }

    snapshots.push({
      stepId,
      positionChanges: changes,
      cumulativePosition: [...cumulativePosition],
      grossOutflowSoFar: totalGrossOutflow,
    })
  }

  const netChange = cumulativePosition.filter(c => c.amount !== 0n)
  const singleToken = isSingleTokenIntent(steps)
  const dominantToken = getDominantToken(steps)

  return {
    steps: snapshots,
    totalGrossOutflow,
    netChange,
    maxIntermediateExposure,
    isSingleToken: singleToken,
    ...(dominantToken !== undefined ? { dominantToken } : {}),
  }
}
