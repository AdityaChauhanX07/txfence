import { randomUUID } from 'node:crypto'
import type {
  AgentCoordinator,
  AgentCoordinatorConfig,
  IntentClaimResult,
} from './types.js'

type IntentEntry = {
  agentId: string
  claimId: string
  expiresAt: number
}

export function createMemoryAgentCoordinator(): AgentCoordinator {
  const agents = new Map<string, AgentCoordinatorConfig>()
  const intents = new Map<string, IntentEntry>()
  const transactions = new Map<string, number[]>()

  return {
    registerAgent(config: AgentCoordinatorConfig): void {
      agents.set(config.agentId, config)
    },

    getRegisteredAgents(): AgentCoordinatorConfig[] {
      return [...agents.values()]
    },

    claimIntent(intentId: string, agentId: string, ttlMs = 30000): Promise<IntentClaimResult> {
      const now = Date.now()
      const existing = intents.get(intentId)

      if (existing !== undefined && existing.expiresAt > now) {
        if (existing.agentId !== agentId) {
          return Promise.resolve({
            claimed: false,
            claimedBy: existing.agentId,
            expiresAt: existing.expiresAt,
          })
        }
        existing.expiresAt = now + ttlMs
        return Promise.resolve({ claimed: true, claimId: existing.claimId })
      }

      const claimId = randomUUID()
      intents.set(intentId, { agentId, claimId, expiresAt: now + ttlMs })
      return Promise.resolve({ claimed: true, claimId })
    },

    releaseIntent(intentId: string, agentId: string): Promise<void> {
      const existing = intents.get(intentId)
      if (existing !== undefined && existing.agentId === agentId) {
        intents.delete(intentId)
      }
      return Promise.resolve()
    },

    comparePriority(agentIdA: string, agentIdB: string): number {
      const a = agents.get(agentIdA)?.priority ?? 0
      const b = agents.get(agentIdB)?.priority ?? 0
      return a - b
    },

    recordTransaction(agentId: string): Promise<void> {
      const now = Date.now()
      const existing = transactions.get(agentId) ?? []
      existing.push(now)
      transactions.set(agentId, existing)
      return Promise.resolve()
    },

    isRateLimited(agentId: string): Promise<boolean> {
      const config = agents.get(agentId)
      if (config?.maxTransactionsPerWindow === undefined) {
        return Promise.resolve(false)
      }
      const { count, windowMs } = config.maxTransactionsPerWindow
      const now = Date.now()
      const timestamps = transactions.get(agentId) ?? []
      const inWindow = timestamps.filter(t => t >= now - windowMs)
      transactions.set(agentId, inWindow)
      return Promise.resolve(inWindow.length >= count)
    },

    getTransactionCount(agentId: string, windowMs: number): Promise<number> {
      const now = Date.now()
      const timestamps = transactions.get(agentId) ?? []
      const inWindow = timestamps.filter(t => t >= now - windowMs)
      transactions.set(agentId, inWindow)
      return Promise.resolve(inWindow.length)
    },
  }
}
