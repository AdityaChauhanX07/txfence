import type { AgentConfig, Agent } from '../types/agent.js'
import type { BoundAction, Action } from '../types/action.js'
import type { ChainId } from '../types/policy.js'
import type { PolicyEvaluation, SuccessReceipt } from '../types/receipt.js'
import type { SimulationResult } from '../types/simulation.js'
import type { AdapterMap } from './adapter.js'
import type { CapLockProvider } from '../caps/provider.js'
import type { MetadataVerifier } from '../verification/provider.js'
import type { ReceiptStore } from '../storage/store.js'
import type { ApprovalProvider } from '../approval/types.js'
import type { TelemetryProvider } from '../telemetry/types.js'
import { runPipeline } from './pipeline.js'

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
): Agent {
  return {
    config,
    submit: (boundAction: BoundAction) =>
      runPipeline(
        boundAction.action,
        boundAction.policy,
        adapters,
        rpcUrls,
        executor,
        capLockProvider,
        metadataVerifier,
        approvalProvider,
        receiptStore,
        auditLog,
        telemetryProvider,
      ),
  }
}
