// Formal policy verification types.
// @txfence/verify provides bounded model checking for policy invariants.
// It generates adversarial transaction sequences to find violations,
// producing concrete counterexamples that show exactly how an invariant
// can be broken.
//
// This is bounded verification — properties are checked up to a configurable
// bound (number of agents, transactions, time window). A property that holds
// within the bound may still be violated outside it. Document your bounds.
//
// Future: Z3 SMT backend for complete proofs (--solver z3 flag, planned).

import type { Policy, ChainId, TokenAmount } from '@txfence/core'
import type { Action } from '@txfence/core'

export type AgentSpec = {
  agentId: string
  maxSpendPerTx: bigint
  token: string
}

export type TransactionScenario = {
  agentId: string
  action: Action
  timestamp: number
  amount: bigint
}

export type CounterExample = {
  description: string
  transactions: TransactionScenario[]
  violatedAt: number
  violatedAmount: bigint
  capLimit: bigint
  checkedBound: CheckBound
}

export type CheckBound = {
  agentCount: number
  transactionsPerAgent: number
  windowMs?: number
}

export type VerificationStatus = 'holds' | 'violated' | 'unknown'

export type VerificationResult =
  | {
      status: 'holds'
      property: string
      checkedBound: CheckBound
      scenariosChecked: number
      durationMs: number
    }
  | {
      status: 'violated'
      property: string
      counterExample: CounterExample
      durationMs: number
    }
  | {
      status: 'unknown'
      property: string
      reason: string
      durationMs: number
    }

export type RollingWindowProperty = {
  kind: 'rolling_window_saturation'
  agentCount: number
  transactionsPerAgent: number
  windowMs: number
  capAmount: bigint
  token: string
  maxSpendPerTx: bigint
}

export type AbsoluteCapProperty = {
  kind: 'absolute_cap_reachability'
  agentCount: number
  transactionsPerAgent: number
  capAmount: bigint
  token: string
  maxSpendPerTx: bigint
}

export type PolicyContainmentProperty = {
  kind: 'policy_containment'
  innerPolicy: Policy
  outerPolicy: Policy
}

export type VerificationProperty =
  | RollingWindowProperty
  | AbsoluteCapProperty
  | PolicyContainmentProperty

// Re-export upstream types used in this module so external consumers can
// reach them without importing @txfence/core directly.
export type { Policy, ChainId, TokenAmount, Action }
