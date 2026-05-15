// Temporal policy logic — stateful rules evaluated against a sliding window
// of pipeline events. Extends the static policy engine with behavioral
// pattern detection over time.
//
// Where static rules ask "is this transaction allowed?" temporal rules ask
// "is this transaction allowed given everything this agent has done recently?"
//
// Examples:
//   - 3 simulation failures in 1 hour → require human approval
//   - Same contract called 5 times in 10 minutes → flag for review
//   - No successful transactions in 2 hours → pause agent
//   - Spend velocity exceeds 50K USDC in 30 minutes → reject
//
// v1: agent behavior and pattern predicates (classes 1 and 2)
// v2: environmental predicates (gas price, block time drift) — requires oracle

import type { Action } from '../types/action.js'
import type { ChainId } from '../types/policy.js'
import type { PolicyRejectionReason } from '../types/receipt.js'

export type PipelineEventOutcome = {
  status:
    | 'success'
    | 'policy_rejected'
    | 'simulation_failed'
    | 'simulation_stale'
    | 'approval_timeout'
    | 'execution_failed'
    | 'temporal_rejected'
  rejectionReason?: PolicyRejectionReason
  txHash?: string
  gasUsed?: string
}

export type PipelineEvent = {
  id: string
  timestamp: number
  agentId: string
  chain: ChainId
  action: Action
  outcome: PipelineEventOutcome
  spendAmount?: bigint
}

export type EventFilter = {
  agentId?: string
  chain?: ChainId
  status?: PipelineEventOutcome['status']
  contractAddress?: string
  from?: number
  to?: number
  windowMs?: number
}

export type EventStore = {
  record: (event: PipelineEvent) => void
  query: (filter?: EventFilter) => PipelineEvent[]
  prune: (olderThan: number) => void
  recent: (
    n: number,
    filter?: Omit<EventFilter, 'from' | 'to' | 'windowMs'>,
  ) => PipelineEvent[]
}

export type TemporalConsequence =
  | { kind: 'require_approval' }
  | { kind: 'reject' }
  | { kind: 'flag_for_review' }

export type TemporalPredicate =
  | {
      kind: 'simulation_failure_rate'
      windowMs: number
      threshold: number
    }
  | {
      kind: 'contract_call_frequency'
      contractAddress: string
      windowMs: number
      threshold: number
    }
  | {
      kind: 'success_drought'
      windowMs: number
      threshold: number
    }
  | {
      kind: 'spend_velocity'
      windowMs: number
      maxAmount: bigint
      token: string
    }
  | {
      kind: 'consecutive_failures'
      count: number
    }
  | {
      kind: 'approval_flood'
      windowMs: number
      threshold: number
    }

export type TemporalRule = {
  predicate: TemporalPredicate
  consequence: TemporalConsequence
  label?: string
}

export type TemporalEvaluationResult = {
  triggered: boolean
  rule?: TemporalRule
  consequence?: TemporalConsequence
  label?: string
  details: string
}
