# Changelog

All notable changes to txfence are documented here.

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
