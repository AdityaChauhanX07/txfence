import type { Intent, IntentStep, IntentRejectionReason } from './types.js'

type GraphValidationResult =
  | { valid: true; executionPlan: string[] }
  | { valid: false; reason: IntentRejectionReason; detail: string }

export function validateIntentGraph(intent: Intent): GraphValidationResult {
  const ids = intent.steps.map(s => s.id)

  // 1. Duplicate step IDs
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      return { valid: false, reason: 'missing_dependency', detail: `duplicate step id: ${id}` }
    }
    seen.add(id)
  }

  // 2. Missing dependencies
  const stepIds = new Set(ids)
  for (const step of intent.steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!stepIds.has(dep)) {
        return {
          valid: false,
          reason: 'missing_dependency',
          detail: `step '${step.id}' depends on '${dep}' which does not exist`,
        }
      }
    }
  }

  // 3. Self-dependency
  for (const step of intent.steps) {
    if (step.dependsOn?.includes(step.id) === true) {
      return {
        valid: false,
        reason: 'cyclic_dependency',
        detail: `step '${step.id}' depends on itself`,
      }
    }
  }

  // 4. Cycle detection via Kahn's algorithm
  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const step of intent.steps) {
    if (!inDegree.has(step.id)) inDegree.set(step.id, 0)
    if (!dependents.has(step.id)) dependents.set(step.id, [])
    for (const dep of step.dependsOn ?? []) {
      inDegree.set(step.id, (inDegree.get(step.id) ?? 0) + 1)
      const deps = dependents.get(dep) ?? []
      deps.push(step.id)
      dependents.set(dep, deps)
    }
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(id)
  }

  const sorted: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    sorted.push(current)
    for (const dependent of dependents.get(current) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 0) - 1
      inDegree.set(dependent, newDegree)
      if (newDegree === 0) queue.push(dependent)
    }
  }

  if (sorted.length !== intent.steps.length) {
    return {
      valid: false,
      reason: 'cyclic_dependency',
      detail: 'intent contains a cyclic dependency between steps',
    }
  }

  return { valid: true, executionPlan: sorted }
}

export function getExecutionPlan(intent: Intent): string[] {
  const result = validateIntentGraph(intent)
  if (!result.valid) throw new Error(result.detail)
  return result.executionPlan
}

export function getPoisonedSteps(
  failedStepId: string,
  steps: IntentStep[],
  skipOptional: boolean = false,
): Set<string> {
  const dependents = new Map<string, string[]>()
  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      const list = dependents.get(dep) ?? []
      list.push(step.id)
      dependents.set(dep, list)
    }
  }

  const poisoned = new Set<string>()
  const queue = [failedStepId]
  while (queue.length > 0) {
    const current = queue.shift()!
    const stepDef = steps.find(s => s.id === current)
    if (current !== failedStepId && stepDef?.optional === true && skipOptional) {
      continue
    }
    for (const dependent of dependents.get(current) ?? []) {
      if (!poisoned.has(dependent)) {
        poisoned.add(dependent)
        queue.push(dependent)
      }
    }
  }
  return poisoned
}

export function checkMaxSteps(intent: Intent): boolean {
  if (intent.intentPolicy?.maxSteps === undefined) return true
  return intent.steps.length <= intent.intentPolicy.maxSteps
}
