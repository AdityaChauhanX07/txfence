# Changelog

All notable changes to txfence are documented here.

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
