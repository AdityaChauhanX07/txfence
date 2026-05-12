import type { AgentConfig, Agent, AgentShutdownResult, AgentHealth } from '../types/agent.js'
import type { Action } from '../types/action.js'
import type { ChainId, Policy } from '../types/policy.js'
import type { ExecutionResult, PolicyEvaluation, SuccessReceipt } from '../types/receipt.js'
import type { SimulationResult } from '../types/simulation.js'
import type { AdapterMap } from './adapter.js'
import type { CapLockProvider, CapConfig } from '../caps/provider.js'
import type { MetadataVerifier } from '../verification/provider.js'
import type { ReceiptStore } from '../storage/store.js'
import type { ApprovalProvider } from '../approval/types.js'
import type { TelemetryProvider } from '../telemetry/types.js'
import { runPipeline } from './pipeline.js'
import { runDryRun } from './run-dry.js'
import type { PolicyNode } from '../engine/composite.js'
import type { DryRunResult } from './dry-run.js'

type AuditLogLike = Parameters<typeof runPipeline>[9]

export function createAgent(
  config: AgentConfig,
  adapters: AdapterMap,
  rpcUrls: Partial<Record<ChainId, string>>,
  executor?: (
    action: Action,
    chainId: ChainId,
    rpcUrl: string,
    evaluation: PolicyEvaluation,
    simulation: SimulationResult,
  ) => Promise<SuccessReceipt>,
  capLockProvider?: CapLockProvider,
  metadataVerifier?: MetadataVerifier,
  approvalProvider?: ApprovalProvider,
  receiptStore?: ReceiptStore,
  auditLog?: AuditLogLike,
  telemetryProvider?: TelemetryProvider,
  capLockConfigs?: CapConfig[],
  policyNode?: PolicyNode,
): Agent {
  let inFlight = 0
  let completed = 0
  let abandoned = 0
  let shuttingDown = false
  const startedAt = Date.now()

  async function dryRun(input: { action: Action; policy: Policy }): Promise<DryRunResult> {
    return runDryRun(
      input.action,
      input.policy,
      adapters,
      rpcUrls,
      capLockProvider,
      policyNode,
      telemetryProvider,
    )
  }

  async function submit(input: { action: Action; policy: Policy }): Promise<ExecutionResult> {
    if (shuttingDown) {
      throw new Error('Agent is shutting down — no new submissions accepted')
    }
    inFlight++
    try {
      const result = await runPipeline(
        input.action,
        input.policy,
        adapters,
        rpcUrls,
        executor,
        capLockProvider,
        metadataVerifier,
        approvalProvider,
        receiptStore,
        auditLog,
        telemetryProvider,
        policyNode,
      )
      completed++
      return result
    } finally {
      inFlight--
    }
  }

  async function shutdown(timeoutMs: number = 30_000): Promise<AgentShutdownResult> {
    shuttingDown = true

    // Wait for in-flight submissions to complete
    const deadline = Date.now() + timeoutMs
    while (inFlight > 0 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    if (inFlight > 0) {
      abandoned = inFlight
      // In-flight submissions are still running but we are past the deadline.
      // We cannot cancel them but we record them as abandoned.
    }

    // Inspect cap locks — individual locks cannot be released without their lockId.
    // The pipeline holds lockIds internally during execution but does not expose them
    // to the agent level. On shutdown, we can inspect how many active locks exist but
    // cannot release them. They will expire naturally when the rolling window expires,
    // or the operator can restart the cap lock provider to clear all pending state.
    let capLocksReleased = 0
    if (capLockProvider !== undefined) {
      const configs = capLockConfigs ?? []
      for (const capConfig of configs) {
        try {
          if (typeof capLockProvider.inspect === 'function') {
            const inspection = await capLockProvider.inspect(capConfig.capId)
            if (inspection.activeLocks > 0) {
              console.warn(
                `[txfence] shutdown: ${inspection.activeLocks} active cap locks on ` +
                `${capConfig.capId} could not be auto-released (lock IDs not tracked at agent level). ` +
                `They will expire naturally or can be cleared by restarting the cap lock provider.`,
              )
              capLocksReleased = 0
            }
          }
        } catch {
          // inspect() is optional — ignore errors
        }
      }
    }

    return { completed, abandoned, capLocksReleased }
  }

  function health(): AgentHealth {
    return {
      status: shuttingDown ? 'shutting_down' : 'healthy',
      inFlight,
      uptime: Date.now() - startedAt,
    }
  }

  return { submit, dryRun, shutdown, isShuttingDown: () => shuttingDown, health, config }
}
