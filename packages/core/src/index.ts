export type { ChainId, TokenAmount, ContractEntry, Policy, CapLockMode } from './types/policy.js'
export type { Action, SwapAction, TransferAction, ContractCallAction, BoundAction, SolanaAccountMeta } from './types/action.js'
export type { SimulationResult, SimulationCoverageLevel, SimulationCaveat, SimulationProvider, SimulateOptions, TenderlyTrace } from './types/simulation.js'
export type { ExecutionResult, SuccessReceipt, PolicyEvaluation, PolicyRejectionReason, ExecutionFailureReason } from './types/receipt.js'
export { formatExecutionFailureReason } from './types/receipt.js'
export type { Agent, AgentConfig, Signer, SerializedTransaction, AgentShutdownResult, AgentHealth } from './types/agent.js'
export { evaluate, evaluateNode, policyLeaf, policyAnd, policyOr } from './engine/index.js'
export type { CheckResult, PolicyNode, PolicyLeaf, PolicyAnd, PolicyOr, PolicyNodeEvaluation } from './engine/index.js'
export { createAgent, runPipeline } from './agent/index.js'
export type { ChainAdapter, AdapterMap } from './agent/index.js'
export { createMemoryCapLockProvider } from './caps/index.js'
export type {
  CapLockProvider,
  CapLockResult,
  CapConfig,
  CapWarningEvent,
  MemoryCapLockProviderOptions,
  RollingWindowConfig,
  AbsoluteCapConfig,
  CapInspection,
  AbsoluteCapInspection,
  RollingWindowInspection,
} from './caps/index.js'
export type { MetadataVerifier, MetadataVerificationResult } from './verification/index.js'
export { createMultiChainAdapter } from './adapters/index.js'
export { getPolicyRejectionMessage, getSimulationFailureMessage } from './errors/index.js'
export { createMemoryReceiptStore, createFileReceiptStore } from './storage/index.js'
export type { ReceiptStore, ReceiptFilter } from './storage/index.js'
export { createMemoryApprovalProvider, createWebhookApprovalProvider } from './approval/index.js'
export type {
  ApprovalProvider, ApprovalRequest, ApprovalDecision,
  PolicyContext, MemoryApprovalProvider, WebhookApprovalOptions,
} from './approval/index.js'
export { diffPolicies, createTestActions } from './diff/index.js'
export type { PolicyDiff, PolicyDiffInput, ActionDiffResult, ActionDiffDirection, ChangedCheck } from './diff/index.js'
export {
  bigintReplacer,
  serializeWithBigInt,
  parseWithBigInt,
  reviveTokenAmount,
  revivePolicy,
  reviveAction,
  reviveSimulationResult,
  reviveSuccessReceipt,
} from './serialization/index.js'
export { receiptStoreContract, capLockProviderContract, auditLogContract, approvalProviderContract } from './contracts/index.js'
export type { MinimalAuditLog } from './contracts/index.js'
export { validateConfig } from './validation/index.js'
export type { ConfigValidationResult, ConfigWarning, ConfigWarningSeverity } from './validation/index.js'
export { noopTelemetry } from './telemetry/index.js'
export type { TelemetryProvider, Span, SpanStatus } from './telemetry/index.js'
export { createCircuitBreaker, wrapAdapterWithCircuitBreaker } from './circuit-breaker/index.js'
export type { CircuitBreaker, CircuitBreakerConfig, CircuitBreakerState } from './circuit-breaker/index.js'
export type { DryRunResult, DryRunBlocker } from './agent/dry-run.js'
export { runDryRun } from './agent/run-dry.js'
export type { NotificationEvent, NotificationProvider } from './notifications/index.js'
export { createConsoleNotificationProvider } from './notifications/index.js'
export type { ConsoleNotificationOptions } from './notifications/index.js'
export { createWebhookNotificationProvider } from './notifications/index.js'
export type { WebhookNotificationOptions } from './notifications/index.js'
export { createCompositeNotificationProvider } from './notifications/index.js'
export {
  getPolicyVersionId,
  createPolicyVersion,
  createPolicyVersionStore,
} from './versioning/index.js'
export type { PolicyVersion, PolicyVersionStore } from './versioning/index.js'
export {
  createMemoryAgentCoordinator,
  getIntentId,
  getIntentIdWithNonce,
} from './coordination/index.js'
export type {
  AgentCoordinator,
  AgentCoordinatorConfig,
  IntentClaimResult,
} from './coordination/index.js'
export {
  evaluateIntent,
  executeIntent,
  validateIntentGraph,
  getExecutionPlan,
  getPoisonedSteps,
  checkMaxSteps,
  analyzeIntentPosition,
  getActionPositionChanges,
  mergePositionChanges,
  isSingleTokenIntent,
  getDominantToken,
} from './intent/index.js'
export type { IntentExecutionOptions } from './intent/index.js'
export type {
  ForkSimulationProvider,
  TenderlyForkConfig,
  ForkSimulationConfig,
  StateChange,
  StepForkSimulationResult,
  ForkSimulationResult,
} from './intent/index.js'
export type {
  Intent,
  IntentStep,
  IntentPolicy,
  IntentEvaluationResult,
  IntentPolicyEvaluationResult,
  StepEvaluationResult,
  IntentRejectionReason,
  IntentExecutionResult,
  IntentExecutionStatus,
  StepExecutionResult,
  PositionChange,
  StepPositionSnapshot,
  IntentPositionAnalysis,
} from './intent/index.js'
export {
  createRegistry,
  defaultRegistry,
  asset,
  protocol,
  maxSpend,
  getAsset,
  getProtocol,
  listAssets,
  listProtocols,
  BUILT_IN_ASSETS,
  BUILT_IN_PROTOCOLS,
} from './registry/index.js'
export type {
  AssetDefinition,
  ProtocolDefinition,
  ProtocolContract,
  ProtocolContractRole,
  Registry,
} from './registry/index.js'
export { replayAuditLog } from './replay/index.js'
export type {
  ReplayEntry,
  ReplayResult,
  ReplayOptions,
  ReplayDirection,
  ReplayableAuditLog,
} from './replay/index.js'