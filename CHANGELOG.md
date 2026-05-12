# Changelog

All notable changes to txfence are documented here.

---

## v0.30.0

Explicit dry-run mode.

- Added `agent.dryRun(input)` method — runs the full pipeline without executing and returns a structured report
- Added `DryRunResult` type with `evaluation`, `simulation`, `approvalRequired`, `approvalThreshold`, `capLockAvailable`, `wouldProceed`, `blockers`, and `dryRunAt` fields
- Added `DryRunBlocker` discriminated union with five variants: `policy_rejected`, `simulation_failed`, `simulation_stale`, `approval_required`, `cap_lock_unavailable`
- Added `runDryRun()` exported function for use outside `createAgent`
- Cap locks are acquired then immediately released during dry run — tests availability without consuming budget
- Approval threshold is checked without dispatching a webhook
- Simulation runs when adapter is configured, returns results without gating on `requireSimulation`
- `wouldProceed: true` only when all checks pass with zero blockers
- Added `txfence dry-run` CLI command — prints a structured report showing what would happen, exits 1 if anything would block execution
- CLI uses the same adapter and RPC config as other commands — simulation runs against real nodes when configured
- `txfence dry-run` is CI-friendly: exit 0 means execution would proceed, exit 1 means something would block
- 8 new tests covering all blocker kinds, cap budget preservation, and timestamp

---

## v0.29.0

Composite policy support with AND/OR trees.

- Added `PolicyNode` type — a discriminated union of `PolicyLeaf`, `PolicyAnd`, and `PolicyOr`
- Added `PolicyLeaf` — wraps a flat `Policy` with an optional label
- Added `PolicyAnd` — all children must pass (vacuous truth for empty children)
- Added `PolicyOr` — at least one child must pass (vacuous false for empty children)
- Added `PolicyNodeEvaluation` — tree-structured evaluation result preserving which nodes passed and why
- Added `evaluateNode(node, action, simulationResult?)` — walks the tree, evaluates each leaf using the existing `evaluate()` function
- Added constructor helpers: `policyLeaf(policy, label?)`, `policyAnd(children, label?)`, `policyOr(children, label?)`
- `firstRejectionReason` propagates from the deepest failing leaf to the root for backward-compatible error reporting
- `runPipeline` accepts optional `policyNode` as the 12th parameter — when provided, uses `evaluateNode()` instead of `evaluate()`
- `createAgent` accepts optional `policyNode` parameter — forwarded to every pipeline call
- Zero breaking changes — flat `Policy` callers are completely unaffected
- 13 new tests covering leaf evaluation, AND semantics, OR semantics, nested composites, and rejection reason propagation

**Example — tiered treasury policy:**
```typescript
import { policyAnd, policyOr, policyLeaf } from '@txfence/core'

const treasuryPolicy = policyAnd([
  policyOr([
    policyLeaf(smallSpendPolicy, 'small-spend'),   // up to 1000 USDC, no approval
    policyLeaf(largeSpendPolicy, 'large-spend'),   // up to 50000 USDC, needs approval
  ], 'spend-tier'),
  policyLeaf(contractAllowlistPolicy, 'allowlist'), // always required
], 'treasury')
```

---

## v0.28.0

Cosmos package test coverage.

- Added `packages/cosmos/src/simulate.test.ts` — 8 unit tests with mocked StargateClient
- Added `packages/cosmos/src/integration.test.ts` — 3 integration tests that skip without `COSMOS_RPC_URL`
- Added `packages/cosmos/src/constants.test.ts` — 8 tests for `isCosmosChain` and `COSMOS_CHAIN_CONFIGS`
- Added `packages/cosmos/vitest.config.ts` — 20 second test timeout for network tests
- Unit tests cover: both chains for TransferAction, SwapAction/ContractCallAction with pre-built bytes, RPC failure path, non-Cosmos chain rejection, rpcUrl forwarding, SwapAction without bytes
- Integration tests cover: real node connectivity, real block height via simulateCosmosAction, graceful failure on unreachable RPC
- Constants tests cover: isCosmosChain true/false cases, chain config field values, all COSMOS_CHAIN_IDS have entries
- Run integration tests: `COSMOS_RPC_URL=https://rpc.cosmos.network pnpm --filter @txfence/cosmos test`
- 26 tests passing, 3 skipped in CI (no COSMOS_RPC_URL set)

---

## v0.27.0

ExecutionFailureReason discriminated union.

**Breaking change:** `execution_failed.reason` is no longer a string. It is now an `ExecutionFailureReason` discriminated union.

- Added `ExecutionFailureReason` type with four variants:
  - `{ code: 'no_executor' }` — no executor configured on the agent
  - `{ code: 'executor_threw'; message: string; cause?: unknown }` — executor threw an error
  - `{ code: 'signing_failed'; message: string }` — signing step failed
  - `{ code: 'broadcast_failed'; message: string; txHash?: string }` — broadcast failed, optionally with a partial txHash
- Added `formatExecutionFailureReason(reason: ExecutionFailureReason): string` helper for human-readable output
- Pipeline updated: no-executor path returns `{ code: 'no_executor' }`, executor-throw path returns `{ code: 'executor_threw', message, cause }`
- Audit log converts to string via `formatExecutionFailureReason` — audit entries remain human-readable
- CLI, MCP, and integration tests updated to use structured type checks
- TypeScript exhaustive switches will warn at compile time when new variants are added
- 5 new tests for `formatExecutionFailureReason`, 2 new pipeline tests for `no_executor` and `executor_threw`

**Migration:** If you switch on `result.status === 'execution_failed'` and read `result.reason`, update to `result.reason.code`. Use `formatExecutionFailureReason(result.reason)` for display.

---

## v0.26.0

Circuit breaker for RPC fault tolerance and migration guide.

**Circuit breaker**
- Added `createCircuitBreaker(config?)` to `@txfence/core`
- Three states: `closed` (normal), `open` (blocking), `half-open` (probing)
- `failureThreshold` (default 5) — consecutive failures before opening
- `successThreshold` (default 2) — consecutive successes in half-open before closing
- `timeoutMs` (default 60000) — ms before transitioning from open to half-open
- `onStateChange` callback — notified on every state transition
- Added `wrapAdapterWithCircuitBreaker(adapter, breaker, chainId)` — composable wrapper for any `ChainAdapter`
- When breaker is open: simulation returns immediately with `success: false, coverageLevel: 'none'` — no RPC call made
- When adapter throws: failure recorded, wrapped result returned gracefully — pipeline sees `simulation_failed`, not an unhandled error
- When simulation succeeds but `wouldRevert: true`: not recorded as a failure — the RPC worked, the transaction would revert
- `reset()` method for manual circuit reset in operational tooling
- 15 new tests covering all state transitions, adapter wrapping, and the wouldRevert distinction
- Composable design: teams wrap their adapter, not buried in the pipeline

**Migration guide**
- Added `MIGRATION.md` at the repo root covering schema evolution strategy, version history, breaking changes per version, and data migration scripts
- Covers: file store NDJSON backward compatibility, PostgreSQL ALTER TABLE strategy, checkpoint file recovery, SimulationResult field additions, ExecutionResult union additions, Agent API changes
- Known limitations documented: no automatic schema migrations, no data versioning, file stores not suitable for high-volume production

---

## v0.25.0

Agent graceful shutdown and health check.

- Added `shutdown(timeoutMs?: number): Promise<AgentShutdownResult>` to the Agent type
- Added `health(): AgentHealth` to the Agent type
- Added `isShuttingDown(): boolean` to the Agent type
- Added `AgentShutdownResult` type with `completed`, `abandoned`, and `capLocksReleased` fields
- Added `AgentHealth` type with `status` ('healthy' | 'shutting_down'), `inFlight`, and `uptime` fields
- `shutdown()` sets the shutting-down flag immediately, then polls every 50ms until in-flight submissions complete or the timeout expires (default 30 seconds)
- `submit()` throws when called after `shutdown()` — no new submissions accepted during drain
- In-flight submissions that exceed the timeout are counted as `abandoned` in the shutdown result
- `shutdown()` inspects cap locks via `capLockProvider.inspect()` and logs a warning if active locks remain — individual lock release requires lock IDs held inside the pipeline, documented as a known limitation
- `health()` returns a snapshot: current status, in-flight count, and uptime since agent creation — suitable for Kubernetes liveness probes and load balancer health checks
- Added optional `capLockConfigs?: CapConfig[]` parameter to `createAgent` for cap inspection on shutdown
- 10 new tests covering health status, uptime tracking, completed count, shutdown rejection, and multi-submission tracking

---

## v0.24.0

TelemetryProvider interface and pipeline instrumentation.

- Added `TelemetryProvider` interface to `@txfence/core` — minimal span-based observability interface
- `Span` type with `setAttribute`, `setStatus`, and `end` methods — structurally compatible with OpenTelemetry spans
- `noopTelemetry` — singleton no-op implementation with zero allocations; `startSpan` always returns the same shared `noopSpan` object
- Pipeline instrumented with 5 spans: `txfence.pipeline` (root), `txfence.policy.evaluate`, `txfence.simulation`, `txfence.approval`, `txfence.execution`
- Root span attributes: `txfence.chain`, `txfence.action.kind`, `txfence.status`, `txfence.rejection_reason`, `txfence.tx_hash`, `txfence.confirmed_at_block`, `txfence.staleness_ms`
- Simulation span attributes: `txfence.simulation.provider`, `txfence.simulation.coverage`, `txfence.simulation.gas_estimate`, `txfence.simulation.would_revert`
- `pipelineSpan.end()` called in `finally` — guaranteed on every exit path including errors
- `telemetryProvider` is optional 11th parameter on `runPipeline` and `createAgent` — zero overhead when not configured
- All existing tests pass with no regressions — noopTelemetry is the default
- 8 new tests covering noop correctness, pipeline span lifecycle, attribute recording, and no-telemetry regression
- A `@txfence/telemetry-otel` package providing real OpenTelemetry implementation is planned

---

## v0.23.0

Domain-aware policy configuration validation.

- Added `validateConfig(policy: Policy): ConfigValidationResult` to `@txfence/core`
- `ConfigValidationResult` has `valid`, `errors`, and `warnings` arrays
- `ConfigWarning` has `field`, `message`, and `severity` fields

**Errors (must fix — will cause runtime failures):**
- `chains` is empty — no actions can ever pass
- `gasBufferMultiplier < 1.0` — every simulated transaction fails the gas buffer check
- `humanApprovalTimeoutMs < 1000` — approval windows under 1 second are unusable
- `maxSpendPerTx.decimals === 0` — almost certainly wrong
- `humanApprovalThreshold.decimals !== maxSpendPerTx.decimals` for the same token — threshold comparisons will be wrong

**Warnings (should fix — will cause unexpected behavior):**
- USDC/USDT with 18 decimals — authorizes 1,000,000,000,000x the intended amount
- ETH/WBTC with 6 decimals — decimals mismatch for known tokens
- `humanApprovalThreshold.amount < maxSpendPerTx.amount` — every transaction triggers approval
- `gasBufferMultiplier > 3.0` — unusually high
- `allowedContracts` empty and `requireSimulation: false` — very permissive policy
- Expired `allowedContracts` entries — will be rejected with `contract_entry_expired`

**Integration:**
- `txfence check-policy` CLI command now runs `validateConfig` first — exits 1 on errors, prints warnings and continues
- Added `txfence_validate_config` MCP tool — AI assistants can validate policies before deploying
- 14 new tests covering all 11 checks

---

## v0.22.0

Cap lock observability, simulation staleness protection, and infrastructure failure taxonomy.

**CapLockProvider.inspect()**
- Added `inspect?: (capId: string) => Promise<CapInspection>` to `CapLockProvider` interface — optional observability method
- Added `CapInspection`, `AbsoluteCapInspection`, `RollingWindowInspection` types
- `createMemoryCapLockProvider` return type narrowed to include `inspect` as required — no non-null assertions needed on the concrete type
- `inspect()` returns remaining budget, total committed, total pending, pctUsed, activeLocks, and rolling window resetsAt timestamp
- 6 new unit tests, 2 new contract tests
- `inspect` is optional on the interface — Redis and other implementations are not required to implement it

**simulationStalenessMs**
- Added `simulationStalenessMs?: number` to `Policy` — maximum milliseconds between simulation and execution
- Added `simulation_stale` to `ExecutionResult` union with `stalenessMs` field
- Pipeline records `simulatedAt` timestamp after simulation completes; checks staleness before handing off to executor
- Returns `{ status: 'simulation_stale', stalenessMs }` when threshold exceeded — agent must re-simulate before retrying
- CLI `txfence submit` formats `simulation_stale` with stale duration and simulated block
- Audit log records `simulation_stale` outcomes
- 3 new pipeline tests, 1 new CLI format test

**Infrastructure failure taxonomy**
- Added `docs/txfence-failure-taxonomy.md` — 8 txfence infrastructure failure modes with detection and mitigation guidance
- Covers: receipt write post-confirmation, Redis cap lock crash, unreachable webhook, audit log disk full, corrupted checkpoint, concurrent file writers, RPC errors (handled), simulation staleness (handled)
- Summary table showing which failures txfence handles vs requires external mitigation

---

## v0.19.0

Developer experience improvements.

- Added `pnpm dev` script at the repo root — starts Anvil (if Foundry is installed) and vitest in watch mode for @txfence/core
- Anvil availability is detected automatically — if not installed, a clear message explains how to install Foundry
- Color-prefixed output per process: green for Anvil, purple for tests
- SIGINT and SIGTERM handled cleanly — all child processes stop on Ctrl+C
- Set ETHEREUM_RPC_URL to use a dedicated RPC endpoint instead of the public node default
- CONTRIBUTING.md updated with pnpm dev usage at the top of the development workflow section
- tsx added as a root devDependency

---

## v0.18.0

End-to-end treasury agent example, security model, runbook, and changesets.

**Treasury agent example**
- Added `examples/treasury-agent/` — complete end-to-end example using all 12 packages
- `policy.ts` — realistic DAO treasury policy: 10,000 USDC per-tx cap, Uniswap V3 and 1inch V5 on allowlist, 50,000 USDC approval threshold, 100,000 USDC rolling window, 500,000 USDC absolute cap
- `run.ts` — 5 pipeline examples in dry-run mode: small transfer, over-cap transfer, Uniswap swap, unlisted contract, high-value approval
- `simulate-policy-change.ts` — policy diff showing blast radius of reducing maxSpendPerTx from 10,000 to 5,000 USDC
- `monitor.ts` — live block scanner connecting to Ethereum mainnet with checkpoint persistence
- All 5 examples produce correct expected outputs verified against a live RPC

**Documentation**
- Added `docs/security-model.md` — threat model, what txfence protects against, what it does not, webhook verification guide, audit log tamper evidence note
- Added `docs/runbook.md` — troubleshooting guide for every PolicyRejectionReason, simulation issues, approval timeouts, monitor alerts, and common configuration mistakes

**Changesets**
- Added `@changesets/cli` for monorepo version management
- `pnpm changeset` creates a changeset, `pnpm version-packages` bumps versions, `pnpm release` publishes
- CONTRIBUTING.md updated with release process documentation

---

## v0.17.0

Property-based tests for the policy engine.

- Added `packages/core/src/engine/engine.property.test.ts` using fast-check
- 8 property tests, 1800 random iterations total
- Properties tested:
  - Evaluation is deterministic — same inputs always produce same outputs
  - checkChain always appears in checksRun
  - Action on unlisted chain always fails with chain_not_allowed
  - Transfer at exactly maxSpendPerTx passes spend check
  - Transfer over maxSpendPerTx always fails with spend_exceeds_cap
  - Swap with maxSlippage === 0 always fails with slippage_not_declared
  - evaluate() never throws for any valid action/policy combination
  - passed: true implies no rejectionReason; passed: false implies rejectionReason defined
- fast-check v4 added as dev dependency in @txfence/core
- Properties use fc.pre() for preconditions and chain() to generate actions from policies
- Property 6 (slippage) explicitly adds the swap router to allowedContracts so the contract check passes before slippage is evaluated — correct isolation technique for property tests

---

## v0.16.0

Contract test suites for core interfaces and atomic checkpoint writes.

**Contract test suites**
- Added `packages/core/src/contracts/` with shared test suites for all four core interfaces
- `receiptStoreContract(name, createStore)` — 7 tests any ReceiptStore implementation must pass
- `capLockProviderContract(name, createProvider)` — 5 tests any CapLockProvider must pass
- `auditLogContract(name, createLog)` — 6 tests any AuditLog must pass
- `approvalProviderContract(name, createProvider)` — 2 tests any ApprovalProvider must pass
- All contract suites exported from `@txfence/core` public surface
- Memory implementations in core and audit now run the contract suites in addition to their own unit tests
- Any new implementation (Redis, PostgreSQL, etc.) can import and run the contract suite to verify substitutability
- `./contracts` subpath export added to `@txfence/core` for correct vitest worker context in dependent packages

**Atomic checkpoint writes**
- Fixed `packages/monitor/src/checkpoint/file.ts` to use write-then-rename pattern
- Writes to `.tmp` file first, then `renameSync` to the real path
- Prevents checkpoint corruption from partial writes
- On POSIX: rename is atomic — readers always see either the old or new file
- On Windows: `.tmp` file is replaced only after a complete write
- 2 new tests confirming no `.tmp` file is left after successful write

---

## v0.15.0

Shared bigint serialization utilities and architecture decision records.

**Shared bigint serialization**
- Added `packages/core/src/serialization/` with shared utilities used by all storage backends
- `bigintReplacer(key, value)` — JSON replacer that converts bigint to string
- `serializeWithBigInt(obj)` and `parseWithBigInt(json)` — consistent serialize/parse wrappers
- `reviveTokenAmount`, `revivePolicy`, `reviveAction`, `reviveSimulationResult`, `reviveSuccessReceipt` — typed revival functions per domain shape
- All revival functions exported from `@txfence/core` public surface
- Refactored `@txfence/storage-pg`, `@txfence/storage-sqlite`, `@txfence/audit`, and `@txfence/mcp` to import from core instead of implementing locally
- `@txfence/audit` serialization.ts reduced from 93 lines to 35 — clonePolicy and deserializeEntry now use shared revival functions
- Correctness fix in `@txfence/storage-sqlite`: policy_eval now serialized with bigintReplacer consistently
- 11 new tests in `packages/core/src/serialization/serialization.test.ts`

**Architecture decision records**
- Added `docs/decisions/` directory with 12 ADRs documenting major design decisions
- Decisions covered: ioredis selection, block scanning approach, policy snapshot cloning, MCP dry-run default, declarative action graph, cancel-on-timeout, tsup build pipeline, better-sqlite3, MCP bin/index separation, per-action simulation result, coverage level naming, ChainAdapter interface location
- Added `docs/decisions/README.md` with ADR format and index

---

## v0.14.0

Policy diff tool.

- Added `diffPolicies(input: PolicyDiffInput): PolicyDiff` to `@txfence/core` — pure function, no async, no chain calls
- Given two policies and a set of test actions, returns which actions changed between them and how
- `ActionDiffDirection` covers three cases: `newly_allowed`, `newly_rejected`, and `rejection_reason_changed` — catches the case where both policies reject but for different reasons
- `ChangedCheck` type shows exactly which checks changed per action, with the rejection reason in each policy
- `summary` block includes `requiresSimulation` count — how many actions had simulation-dependent checks skipped because no simulationResult was provided
- Added `createTestActions(policy: Policy): Array<{ action: Action }>` — generates a minimal covering set: action at spend limit, action over limit, swap per allowed contract, swap targeting unlisted contract, swap with zero slippage
- Added `txfence diff` CLI command — `--config-a`, `--config-b`, `--actions-file` or `--generate-actions`; exits 1 if newly-rejected actions found (CI-friendly for policy change review)
- Added `txfence_diff_policies` MCP tool — AI assistants can compare policies and explain the blast radius of a change; auto-generates test actions from policyA if none provided
- 10 new tests in `packages/core/src/diff/diff.test.ts` covering all three direction values, mixed summaries, requiresSimulation counting, and createTestActions shape

---

## v0.13.0

On-chain reconciliation monitor.

- Added `@txfence/monitor` package
- Forward reconciliation — scans blocks for transactions from known agent addresses and checks if each one exists in the receipt store; detects signing key compromise or out-of-band execution
- Reverse reconciliation — checks recorded receipts against on-chain state to detect chain reorganizations; runs on a separate `reconcileIntervalMs` interval (default 5 minutes)
- `UnrecordedTransactionEvent` with `severity: 'warning' | 'critical'` — warning fires immediately, critical fires after the grace period expires (default 30 seconds)
- Separate `onCriticalTransaction` callback for escalation handling distinct from general warnings
- `CheckpointStore` interface with memory and file implementations — persists last checked block and pending transaction set across process restarts
- `createFileCheckpointStore(path)` — JSON file, reads and writes atomically per check, survives restarts
- `maxBlocksPerPoll` (default 5) — limits RPC calls per poll interval; documented prominently that dedicated RPC endpoints are required in production
- `reconcileIntervalMs` (default 300000) — separate from `pollIntervalMs` (default 12000) since reverse reconciliation is expensive
- `ReorgEvent` fired when a recorded receipt's transaction is missing or in a different block on-chain
- EVM only in v1 — Solana and Cosmos monitoring planned
- 11 tests covering checkpoint stores, file persistence, and monitor lifecycle

---

## v0.12.0

Append-only audit log for compliance teams.

- Added `@txfence/audit` package
- `AuditEntry` type captures every agent decision: action, policy snapshot at decision time, policy evaluation, simulation result, approval request and decision if applicable, and final outcome
- `AuditOutcome` discriminated union covers all pipeline outcomes: `success`, `policy_rejected`, `simulation_failed`, `approval_timeout`, `execution_failed`, and `dry_run` (with `stoppedAt` field)
- `AuditFilter` supports filtering by `chain`, `from`/`to` timestamp, `status`, and `actionKind`
- `createMemoryAuditLog()` — in-memory implementation for development and testing
- `createFileAuditLog(path)` — append-only NDJSON file backend, one entry per line, never rewrites
- `clonePolicy()` — deep clones policy with bigint revival; called inside `record()` so policySnapshot is immutable even if caller mutates the policy object after recording
- Full bigint serialization round-trip for action, policy snapshot, and simulation fields
- Wired into `runPipeline` as optional 10th parameter — every pipeline outcome is recorded regardless of success or failure
- `createAgent` accepts and forwards the `auditLog` parameter
- Known limitation documented in README: no tamper evidence in v1 — the file backend is append-only but does not chain entries with hashes
- 14 tests covering memory and file backends, bigint round-trips, filtering, policy mutation safety, and clonePolicy correctness

---

## v0.11.3

Cap warning callbacks for proactive threshold alerts.

- Added `warningThresholdPct?: number` to `CapConfig` — triggers warning when this percentage of either cap is reached (e.g. 80 means warn at 80% consumed)
- Added `CapWarningEvent` type with `capId`, `type` (absolute or rolling_window), `currentAmount`, `capAmount`, `pctUsed`, and `token`
- Added `onCapWarning?: (event: CapWarningEvent) => void` callback to `CapLockProvider` interface
- Added `MemoryCapLockProviderOptions` type — pass `{ onCapWarning }` as second argument to `createMemoryCapLockProvider`
- Warning fires twice per transaction: once on `acquire` (projected spend crosses threshold) and once on `commit` (confirmed spend crosses threshold)
- Warning fires independently for absolute cap and rolling window cap — teams get separate signals for each control
- No warning fires if `warningThresholdPct` is not set on the config
- No warning fires if no callback is provided — safe to call without options
- 8 new tests covering threshold boundary, both cap types, commit firing, dual-cap firing, and no-callback safety

---

## v0.11.2

SQLite receipt storage backend.

- Added `@txfence/storage-sqlite` package
- `createSqliteReceiptStore(db, options?)` — implements the `ReceiptStore` interface backed by SQLite via better-sqlite3
- `initSchema(db, options?)` — synchronous schema creation, idempotent, run once on startup
- Uses better-sqlite3 (synchronous API) wrapped in Promise.resolve() to match the async ReceiptStore interface
- `INSERT OR REPLACE` for idempotent upserts
- `tableName` option defaults to `txfence_receipts`, fully configurable
- In-memory database support: pass `':memory:'` as the database path for tests
- JSON serialization for action, policy_eval, and simulation fields (SQLite TEXT vs PostgreSQL JSONB)
- Full bigint round-trip via string serialization
- Indexes on `chain` and `confirmed_at_block` for efficient filtering
- 12 tests using an in-memory SQLite database — no external dependencies required
- Peer dependency on `better-sqlite3 ^9.4.3`
- When to use: SQLite for local development and single-process staging, PostgreSQL for production multi-process deployments

---

## v0.11.1

Expanded integration test suite.

- Expanded packages/integration from 5 to 12 tests
- Added 7 pure policy pipeline tests that run without Anvil in any environment: slippage not declared, contract not on allowlist, spend exceeds cap, gas buffer below minimum, expired contract entry, approval timeout with no provider, approval rejected via memory provider
- Added 2 new Anvil tests: cap lock blocks second concurrent transfer, approval approved proceeds to execution
- Tests split into two describe blocks: pure policy tests always run, Anvil tests skip when ANVIL_URL is not set
- All 12 tests pass against a real Anvil mainnet fork

---

## v0.11.0

Cosmos chain adapter.

- Added `@txfence/cosmos` package with support for `cosmoshub` and `osmosis`
- Added `'cosmoshub'` and `'osmosis'` to the `ChainId` union in `@txfence/core`
- Added `cosmosTransaction?: Uint8Array` field to `TransferAction`, `SwapAction`, and `ContractCallAction` — builder provides pre-built Protobuf-encoded transaction bytes
- `simulateCosmosAction` — connects via `StargateClient`, fetches current block height, returns conservative 80000 gas placeholder for MsgSend (full simulate endpoint requires signed transaction with sequence number)
- `buildCosmosTransaction` — passes through `cosmosTransaction` bytes for all action kinds; native MsgSend building deferred until cosmjs-types integration
- `createCosmosSignerFromMnemonic` — creates a signer from a BIP39 mnemonic using `DirectSecp256k1HdWallet` from `@cosmjs/proto-signing`
- `broadcastAndConfirmCosmos` — broadcasts raw transaction bytes via `StargateClient.broadcastTx` and assembles `SuccessReceipt`
- `executeCosmosAction` — composes build, sign, and broadcast into a single call
- Chain configs for `cosmoshub` (cosmoshub-4, uatom) and `osmosis` (osmosis-1, uosmo) with gas prices
- 10 tests covering all action kinds, pre-built byte passthrough, and chain validation
- Same pattern as `@txfence/evm` and `@txfence/solana` — consistent adapter architecture

---

## v0.10.1

PostgreSQL receipt storage backend.

- Added `@txfence/storage-pg` package
- `createPgReceiptStore(pool, options?)` — implements the `ReceiptStore` interface backed by PostgreSQL
- `initSchema(pool, options?)` — idempotent schema creation, run once on startup
- Accepts injected `pg.Pool` — txfence does not manage the connection lifecycle
- `tableName` option defaults to `txfence_receipts`, fully configurable
- Indexes on `chain` and `confirmed_at_block` for efficient filtering
- `ON CONFLICT DO UPDATE` on save — idempotent upserts
- Full bigint serialization round-trip via string conversion for JSONB storage
- 12 tests using a mock Pool — no real database required in CI
- Peer dependency on `pg ^8.11.0`

---

## v0.10.0

Tenderly simulation integration and SimulationResult type upgrades.

**SimulationResult type changes**
- Added `wouldRevert: boolean` field — distinguishes simulation infrastructure failure from on-chain revert
- Added `revertReason?: string` field — revert message when wouldRevert is true
- Added `provider: 'eth_call' | 'tenderly'` field — explicit simulation method tracking
- Added `trace?: TenderlyTrace` field — full execution trace when provider is tenderly
- Renamed coverage levels: eth_call simulation now reports `'basic'` instead of `'partial'`; Tenderly reports `'deep'`
- Added `SimulateOptions` type with `stateOverrides` for hypothetical state simulation
- Added `SimulationProvider` and `TenderlyTrace` types

**Tenderly integration in @txfence/evm**
- Added `TenderlyConfig` type with `accessKey`, `accountSlug`, `projectSlug`
- Added `simulateWithTenderly(action, chainId, rpcUrl, config, options?)` — calls Tenderly Simulation API
- `simulateEvmAction` now accepts optional `tenderlyConfig` — routes to Tenderly when configured, falls back to eth_call
- Tenderly simulation returns `coverageLevel: 'deep'` and full call trace
- `proxy_implementation_unverified` caveat is not added for Tenderly simulations — Tenderly traces through proxies
- `state_may_diverge` caveat always present — honest about execution time uncertainty
- State overrides supported via `options.stateOverrides` — maps address to balance/nonce overrides
- 7 new tests covering success, revert detection, network failure, URL construction, and state overrides

**ChainAdapter interface change**
- `simulate` method now accepts optional fourth parameter `options?: SimulateOptions`

---

## v0.9.0

Hardened for production and webhook-based human approval system.

**Production hardening**
- Added tsup build pipeline — all 7 publishable packages compile to dist/ with declaration files and source maps
- Added GitHub Actions CI — type check, build, and test on every push to main
- Added CONTRIBUTING.md with setup instructions, development workflow, and design principles
- Added CHANGELOG.md
- Fixed @txfence/mcp architecture — separated bin.ts (CLI entry) from index.ts (library barrel) so importing from @txfence/mcp does not start the server
- Fixed deep import issue — config utilities exported from @txfence/mcp public surface

**Webhook approval system**
- Added ApprovalProvider interface with request() and poll() methods
- Added createWebhookApprovalProvider(webhookUrl, pollUrl, options?) — dispatches approval requests via HTTP POST with HMAC-SHA256 signature in X-TXFence-Signature header; polls for decisions
- Added createMemoryApprovalProvider() — in-memory implementation for testing with decide() and pending() helpers
- Added PolicyContext type — compact policy summary included in webhook payloads (no full policy leakage)
- Webhook payload includes approveUrl and rejectUrl for one-click email approval
- Poll endpoint accepts GET with decision query param for email link handling
- Pipeline polls with 50ms interval, stops cleanly on timeout with cancelled flag to prevent race conditions
- approvalProvider is an optional parameter on createAgent and runPipeline
- 10 new tests covering both the memory provider and pipeline integration

---

## v0.8.0

Pluggable receipt storage.

- Added `ReceiptStore` interface to `@txfence/core` with `save`, `get`, and `list` methods
- Added `createMemoryReceiptStore` — in-memory implementation for development and testing
- Added `createFileReceiptStore` — newline-delimited JSON file backend for production use
- Added `ReceiptFilter` type supporting filtering by chain, from block, and to block
- Wired receipt store into the execution pipeline — successful transactions are automatically saved
- `createAgent` and `runPipeline` accept an optional `receiptStore` parameter
- 13 new tests covering both implementations including bigint serialization round-trips

---

## v0.7.0

React hooks package.

- Added `@txfence/react` package with four hooks: `useAgent`, `useSimulate`, `useSubmit`, `useReceipt`
- Chain-agnostic — no dependency on `@txfence/evm` or viem; builders inject their own adapters
- `useAgent` creates a stable agent instance memoized for the component lifetime
- `useSimulate` wraps adapter simulation with loading, result, and error state
- `useSubmit` wraps the full pipeline with loading, result, and error state
- `useReceipt` polls for a transaction receipt using a caller-supplied chain-specific fetcher
- 7 tests using jsdom and `@testing-library/react`

---

## v0.6.0

Proper config system.

- Added `env(key)` and `envOptional(key)` helpers to `@txfence/mcp` for safe environment variable access
- Added Zod schema validation to `loadConfig` — invalid configs surface clear, structured error messages
- Added `txfence init` CLI command that scaffolds a commented `txfence.config.ts` in the current directory
- Policy overrides in `txfence_submit` are now enforced to narrow only — overrides cannot exceed base policy values
- 5 new tests for env helpers

---

## v0.5.0

CLI package.

- Added `@txfence/cli` package with five commands: `simulate`, `check-policy`, `submit`, `receipt`, `init`
- `txfence simulate` runs simulation and prints formatted output including gas estimate, coverage, and caveats
- `txfence check-policy` evaluates an action against the configured policy and exits non-zero on rejection — CI-friendly
- `txfence submit` runs the full pipeline, dry run by default, `--execute` flag for live transactions
- `txfence receipt` retrieves on-chain transaction details by hash
- Output formatting includes human-readable policy evaluation, simulation result, and execution result
- 7 tests covering all three formatters

---

## v0.4.0

MCP server.

- Added `@txfence/mcp` package exposing txfence as a Model Context Protocol server
- Five tools: `txfence_simulate`, `txfence_check_policy`, `txfence_submit`, `txfence_get_receipt`, `txfence_explain_rejection`
- `txfence_submit` defaults to `dryRun: true` — execution requires explicit opt-in
- Server-side base policy with optional per-call overrides that can only narrow, not widen
- `defineConfig`, `env`, and `envOptional` helpers for `txfence.config.ts`
- Fixed Windows path loading using `pathToFileURL`
- See `packages/mcp/README.md` for full tool reference

---

## v0.3.1

Solana swap and contract call execution.

- `SwapAction` on Solana now accepts `solanaTransaction?: Uint8Array` — pre-built transaction bytes from Jupiter or any aggregator
- `ContractCallAction` on Solana accepts either `solanaTransaction` (pre-built) or `solanaData` + `solanaAccounts` (instruction-level)
- Added `SolanaAccountMeta` type with role enum: `writable_signer`, `readonly_signer`, `writable`, `readonly`
- Builder provides protocol-specific encoding; txfence handles policy, simulation, signing, and broadcasting
- 5 new Solana build tests

---

## v0.3.0

Anvil integration tests and signing fix.

- Added `packages/integration` with 5 end-to-end tests against a local Anvil fork
- Tests cover: simulation, policy rejection (chain mismatch, spend cap), real ETH transfer, graceful execution failure
- Fixed `privateKeySigner` — wallet client now uses the correct RPC URL from `SerializedTransaction.rpcUrl` instead of the public mainnet RPC
- Added `rpcUrl` field to `SerializedTransaction` type
- Fixed WSL networking for Windows development (Anvil binds to `0.0.0.0`, tests use WSL IP)

---

## v0.2.0

Signing layers for EVM and Solana.

**EVM signing**
- Added `buildEvmTransaction` — constructs a `SerializedTransaction` from a txfence `Action`
- Added `privateKeySigner` — development signer using viem's wallet client; accepts pre-encoded calldata
- Added `broadcastAndConfirm` — sends raw transaction and waits for receipt
- Added `executeEvmAction` — wires build, sign, and broadcast into a single call
- Philosophy B enforced: `calldata` field on `SwapAction` and `ContractCallAction` — builder provides encoding, txfence handles the rest

**Solana signing**
- Added `buildSolanaTransaction` — builds SystemProgram transfer using `@solana/kit` primitives
- Added `privateKeySolanaSignerFromBytes` — ed25519 keypair signing with Web Crypto API
- Added `broadcastAndConfirmSolana` — base64 encodes, sends via RPC, polls for confirmation
- Solana compute unit estimation is placeholder pending a signing layer for CU simulation

**Infrastructure**
- Added `@txfence/redis` package with atomic Lua scripts for acquire, commit, and release
- Added `createMultiChainAdapter` — routes simulation to the correct adapter by chain
- Added `getPolicyRejectionMessage` and `getSimulationFailureMessage` for human-readable error output
- Contract metadata verification: bytecode hash pinning, owner address check, expiry timestamp
- `createEvmMetadataVerifier` in `@txfence/evm`

---

## v0.1.0

Initial scaffold.

- Monorepo setup with pnpm workspaces: `@txfence/core`, `@txfence/evm`, `@txfence/solana`
- Type definitions: `Policy`, `Action`, `SimulationResult`, `ExecutionResult`, `SuccessReceipt`, `PolicyEvaluation`
- Policy engine with 6 checks: chain, contract, spend cap, slippage, simulation required, gas buffer
- Cap locking: absolute cap and rolling window, two-phase acquire/commit/release
- In-memory `CapLockProvider` for single-process multi-agent environments
- `runPipeline` orchestrating policy evaluation, simulation, human approval threshold, and execution
- EVM chain adapter with `simulateEvmAction` using viem
- Solana chain adapter with `simulateSolanaAction` using `@solana/kit`
- Failure taxonomy: 8 documented failure modes with root causes and mitigation strategies
- Technical essay: 7-section design document published before implementation
- 39 tests across core package

---
