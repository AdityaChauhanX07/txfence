import type { Action } from '../types/action.js'
import type { PolicyEvaluation, PolicyRejectionReason, ExecutionFailureReason, SuccessReceipt } from '../types/receipt.js'
import type { ChainId } from '../types/policy.js'
import type { CapWarningEvent } from '../caps/provider.js'

export type NotificationEvent =
  | {
      kind: 'approval_requested'
      action: Action
      requestedAt: number
      expiresAt: number
      thresholdAmount: bigint
      thresholdToken: string
    }
  | {
      kind: 'approval_decision'
      action: Action
      decision: 'approved' | 'rejected' | 'timeout'
      decidedAt: number
    }
  | {
      kind: 'policy_rejected'
      action: Action
      reason: PolicyRejectionReason
      evaluation: PolicyEvaluation
    }
  | {
      kind: 'execution_success'
      receipt: SuccessReceipt
    }
  | {
      kind: 'execution_failed'
      action: Action
      reason: ExecutionFailureReason
    }
  | {
      kind: 'cap_warning'
      event: CapWarningEvent
    }
  | {
      kind: 'monitor_unrecorded'
      chain: ChainId
      txHash: string
      fromAddress: string
      toAddress: string | null
      value: string
      blockNumber: number
      detectedAt: number
      severity: 'warning' | 'critical'
    }
  | {
      kind: 'monitor_reorg'
      chain: ChainId
      txHash: string
      originalBlock: number
      detectedAt: number
    }

export type NotificationProvider = {
  notify: (event: NotificationEvent) => Promise<void>
}
