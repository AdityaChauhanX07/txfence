import type { ApprovalProvider, ApprovalDecision, ApprovalRequest } from './types.js'

export type MemoryApprovalProvider = ApprovalProvider & {
  decide: (token: string, decision: ApprovalDecision) => void
  pending: () => ApprovalRequest[]
}

export function createMemoryApprovalProvider(): MemoryApprovalProvider {
  const decisions = new Map<string, ApprovalDecision>()
  const requests: ApprovalRequest[] = []

  return {
    request(req: ApprovalRequest): Promise<void> {
      requests.push(req)
      return Promise.resolve()
    },

    poll(token: string): Promise<ApprovalDecision | null> {
      return Promise.resolve(decisions.get(token) ?? null)
    },

    decide(token: string, decision: ApprovalDecision): void {
      decisions.set(token, decision)
    },

    pending(): ApprovalRequest[] {
      return [...requests]
    },
  }
}
