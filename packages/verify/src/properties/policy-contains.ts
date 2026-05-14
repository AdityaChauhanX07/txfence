import { diffPolicies, createTestActions } from '@txfence/core'
import type {
  PolicyContainmentProperty,
  TransactionScenario,
  VerificationResult,
} from '../types.js'

export function checkPolicyContainment(
  property: PolicyContainmentProperty,
): VerificationResult {
  const startTime = Date.now()
  const { innerPolicy, outerPolicy } = property

  const actions = createTestActions(innerPolicy)

  const diff = diffPolicies({
    policyA: innerPolicy,
    policyB: outerPolicy,
    actions,
  })

  const violations = diff.results.filter(r => r.direction === 'newly_rejected')

  if (violations.length > 0) {
    const first = violations[0]!
    const action = first.action

    const amount: bigint =
      action.kind === 'transfer'
        ? action.token.amount
        : action.kind === 'swap'
          ? action.from.amount
          : (action.value?.amount ?? 0n)

    const txScenario: TransactionScenario = {
      agentId: 'agent-0',
      action,
      timestamp: Date.now(),
      amount,
    }

    return {
      status: 'violated',
      property: 'policy_containment: innerPolicy is NOT contained in outerPolicy',
      counterExample: {
        description:
          `Action allowed by innerPolicy is rejected by outerPolicy. ` +
          `Rejection reason: ${first.evaluationB.rejectionReason}. ` +
          `This means outerPolicy is more restrictive than innerPolicy — ` +
          `containment does not hold.`,
        transactions: [txScenario],
        violatedAt: 0,
        violatedAmount: amount,
        capLimit: outerPolicy.maxSpendPerTx.amount,
        checkedBound: {
          agentCount: 1,
          transactionsPerAgent: actions.length,
        },
      },
      durationMs: Date.now() - startTime,
    }
  }

  return {
    status: 'holds',
    property: 'policy_containment: innerPolicy is contained in outerPolicy',
    checkedBound: {
      agentCount: 1,
      transactionsPerAgent: actions.length,
    },
    scenariosChecked: actions.length,
    durationMs: Date.now() - startTime,
  }
}
