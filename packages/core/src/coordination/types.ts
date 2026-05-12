export type AgentCoordinatorConfig = {
  agentId: string
  priority?: number
  maxTransactionsPerWindow?: {
    count: number
    windowMs: number
  }
}

export type IntentClaimResult =
  | { claimed: true; claimId: string }
  | { claimed: false; claimedBy: string; expiresAt: number }

export type AgentCoordinator = {
  claimIntent: (
    intentId: string,
    agentId: string,
    ttlMs?: number,
  ) => Promise<IntentClaimResult>

  releaseIntent: (intentId: string, agentId: string) => Promise<void>

  comparePriority: (agentIdA: string, agentIdB: string) => number

  recordTransaction: (agentId: string) => Promise<void>
  isRateLimited: (agentId: string) => Promise<boolean>
  getTransactionCount: (agentId: string, windowMs: number) => Promise<number>

  registerAgent: (config: AgentCoordinatorConfig) => void
  getRegisteredAgents: () => AgentCoordinatorConfig[]
}
