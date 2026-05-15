// Temporal predicate evaluator.
// Evaluates a list of temporal rules against the event store and
// returns the first triggered rule (rules are evaluated in order).
// Returns { triggered: false } if no rules fire.
//
// Evaluation is pure given the event store state — the same store
// contents always produce the same result for the same rules.

import type {
  TemporalRule,
  TemporalPredicate,
  TemporalEvaluationResult,
  EventStore,
  EventFilter,
} from './types.js'
import type { Action } from '../types/action.js'

function getSpendAmount(action: Action): bigint {
  switch (action.kind) {
    case 'transfer':
      return action.token.amount
    case 'swap':
      return action.from.amount
    case 'contract_call':
      return action.value?.amount ?? 0n
  }
}

function evaluatePredicate(
  predicate: TemporalPredicate,
  store: EventStore,
  action: Action,
  agentId: string,
): { triggered: boolean; details: string } {
  switch (predicate.kind) {
    case 'simulation_failure_rate': {
      const filter: EventFilter = {
        status: 'simulation_failed',
        windowMs: predicate.windowMs,
        ...(agentId.length > 0 ? { agentId } : {}),
      }
      const simFailures = store.query(filter)
      const triggered = simFailures.length >= predicate.threshold
      return {
        triggered,
        details: triggered
          ? `${simFailures.length} simulation failures in the last ${predicate.windowMs}ms ` +
            `(threshold: ${predicate.threshold})`
          : `${simFailures.length}/${predicate.threshold} simulation failures in window`,
      }
    }

    case 'contract_call_frequency': {
      const filter: EventFilter = {
        contractAddress: predicate.contractAddress,
        windowMs: predicate.windowMs,
        ...(agentId.length > 0 ? { agentId } : {}),
      }
      const calls = store.query(filter)
      const triggered = calls.length >= predicate.threshold
      return {
        triggered,
        details: triggered
          ? `Contract ${predicate.contractAddress.slice(0, 10)}... called ${calls.length} times ` +
            `in ${predicate.windowMs}ms (threshold: ${predicate.threshold})`
          : `${calls.length}/${predicate.threshold} calls to contract in window`,
      }
    }

    case 'success_drought': {
      const filter: EventFilter = {
        status: 'success',
        windowMs: predicate.windowMs,
        ...(agentId.length > 0 ? { agentId } : {}),
      }
      const successes = store.query(filter)
      const triggered = successes.length < predicate.threshold
      return {
        triggered,
        details: triggered
          ? `Only ${successes.length} successful transactions in the last ${predicate.windowMs}ms ` +
            `(minimum required: ${predicate.threshold})`
          : `${successes.length} successes in window (minimum: ${predicate.threshold})`,
      }
    }

    case 'spend_velocity': {
      const filter: EventFilter = {
        status: 'success',
        windowMs: predicate.windowMs,
        ...(agentId.length > 0 ? { agentId } : {}),
      }
      const velocityEvents = store.query(filter)
      const windowSpend = velocityEvents
        .filter(e => {
          const a = e.action
          if (a.kind === 'transfer') return a.token.token === predicate.token
          if (a.kind === 'swap') return a.from.token === predicate.token
          if (a.kind === 'contract_call') return a.value?.token === predicate.token
          return false
        })
        .reduce((sum, e) => sum + (e.spendAmount ?? 0n), 0n)

      const currentSpend = getSpendAmount(action)
      const totalSpend = windowSpend + currentSpend

      const triggered = totalSpend >= predicate.maxAmount
      return {
        triggered,
        details: triggered
          ? `Spend velocity: ${totalSpend} ${predicate.token} in ${predicate.windowMs}ms ` +
            `(including current tx) exceeds limit of ${predicate.maxAmount} ${predicate.token}`
          : `Spend velocity: ${totalSpend}/${predicate.maxAmount} ${predicate.token} in window`,
      }
    }

    case 'consecutive_failures': {
      const recentEvents = store.recent(
        predicate.count,
        agentId.length > 0 ? { agentId } : undefined,
      )
      const allFailed =
        recentEvents.length === predicate.count &&
        recentEvents.every(e => e.outcome.status !== 'success')
      return {
        triggered: allFailed,
        details: allFailed
          ? `Last ${predicate.count} consecutive pipeline events all failed`
          : `${recentEvents.filter(e => e.outcome.status !== 'success').length}/${predicate.count} ` +
            `recent events failed (need ${predicate.count} consecutive)`,
      }
    }

    case 'approval_flood': {
      const filter: EventFilter = {
        status: 'approval_timeout',
        windowMs: predicate.windowMs,
        ...(agentId.length > 0 ? { agentId } : {}),
      }
      const approvals = store.query(filter)
      const triggered = approvals.length >= predicate.threshold
      return {
        triggered,
        details: triggered
          ? `${approvals.length} approval timeouts in ${predicate.windowMs}ms ` +
            `(threshold: ${predicate.threshold})`
          : `${approvals.length}/${predicate.threshold} approval timeouts in window`,
      }
    }
  }
}

export function evaluateTemporalRules(
  rules: TemporalRule[],
  store: EventStore,
  action: Action,
  agentId: string,
): TemporalEvaluationResult {
  if (rules.length === 0) {
    return { triggered: false, details: 'No temporal rules configured' }
  }

  for (const rule of rules) {
    const { triggered, details } = evaluatePredicate(
      rule.predicate,
      store,
      action,
      agentId,
    )
    if (triggered) {
      return {
        triggered: true,
        rule,
        consequence: rule.consequence,
        ...(rule.label !== undefined ? { label: rule.label } : {}),
        details,
      }
    }
  }

  return {
    triggered: false,
    details: `All ${rules.length} temporal rule(s) evaluated — none triggered`,
  }
}
