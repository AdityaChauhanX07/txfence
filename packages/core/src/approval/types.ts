import type { Action } from '../types/action.js'

export type PolicyContext = {
  maxSpendPerTx: { token: string; amount: string }
  humanApprovalThreshold: { token: string; amount: string }
  rejectionReason?: string
}

export type ApprovalRequest = {
  token: string
  action: Action
  simulation: {
    gasEstimate: string
    coverageLevel: string
    caveats: string[]
  }
  policyContext: PolicyContext
  requestedAt: string
  expiresAt: string
  approveUrl: string
  rejectUrl: string
}

export type ApprovalDecision = 'approved' | 'rejected'

export type ApprovalProvider = {
  request: (req: ApprovalRequest) => Promise<void>
  poll: (token: string) => Promise<ApprovalDecision | null>
}
