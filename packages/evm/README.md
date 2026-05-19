# @txfence/evm

EVM chain adapter for [txfence](https://github.com/AdityaChauhanX07/txfence). Simulation (`eth_call` + Tenderly), fork simulation, signing, broadcast, and MEV-protected RPC routing for Ethereum, Arbitrum, Optimism, Base, and any EVM chain supported by viem.

## Installation

```bash
npm install @txfence/evm @txfence/core viem
```

## Quick start

```typescript
import { createAgent, type Policy } from '@txfence/core'
import { simulateEvmAction, executeEvmAction, privateKeySigner } from '@txfence/evm'

const signer = privateKeySigner(process.env.PRIVATE_KEY as `0x${string}`)

const agent = createAgent(
  { chains: ['ethereum'], policies: policy, signer },
  { ethereum: { simulate: simulateEvmAction } },
  { ethereum: 'https://ethereum.publicnode.com' },
  (action, chainId, rpcUrl, evaluation, simulation) =>
    executeEvmAction(action, chainId, rpcUrl, signer, evaluation, simulation),
)
```

## Tenderly simulation

Pass a `TenderlyConfig` and `simulateEvmAction` upgrades from `eth_call` to a full Tenderly simulation — state diffs, traces, balance changes:

```typescript
import { simulateEvmAction } from '@txfence/evm'

const result = await simulateEvmAction(action, 'ethereum', rpcUrl, {
  tenderly: {
    accessKey:   process.env.TENDERLY_ACCESS_KEY!,
    accountSlug: process.env.TENDERLY_ACCOUNT_SLUG!,
    projectSlug: process.env.TENDERLY_PROJECT_SLUG!,
  },
})
// result.coverageLevel: 'full' when Tenderly returns; 'partial' on eth_call fallback
```

## Fork simulation

Simulate a multi-step intent against a forked chain state:

```typescript
import { simulateIntentOnFork } from '@txfence/evm'

const result = await simulateIntentOnFork(
  rebalanceIntent,
  {
    provider: 'tenderly',
    tenderlyConfig: { accessKey, accountSlug, projectSlug },
    fromAddress: agentAddress,
  },
  'ethereum',
  rpcUrl,
)
// result.wouldAllSucceed, result.finalPosition, result.failingStepId
// The fork is automatically deleted after simulation.
```

## MEV protection

Route through Flashbots Protect or MEV Blocker:

```typescript
const policy: Policy = {
  // ...
  mevProtection: 'flashbots',  // 'flashbots' | 'mev-blocker' | 'none'
}
```

`getMevProtectedRpcUrl()` and `broadcastWithMevProtection()` are exported for advanced cases.

## Metadata verification

Validate that a contract's on-chain bytecode matches an expected implementation hash:

```typescript
import { createEvmMetadataVerifier } from '@txfence/evm'

const verifier = createEvmMetadataVerifier(rpcUrl)
const ok = await verifier.verify('0xCONTRACT', 'ethereum', { implementationHash: '0x...' })
```

Catches proxy upgrades and unexpected implementations before signing.

## Exports

- `simulateEvmAction`, `simulateWithTenderly` — simulation
- `executeEvmAction`, `buildEvmTransaction` — execution
- `createFork`, `simulateOnFork`, `deleteFork`, `simulateIntentOnFork` — fork simulation
- `privateKeySigner` — viem-backed `Signer`
- `getMevProtectedRpcUrl`, `broadcastWithMevProtection` — MEV routing
- `createEvmMetadataVerifier` — on-chain contract verification
- `getViemChain` — chain id → viem `Chain` helper

Full project README: https://github.com/AdityaChauhanX07/txfence

## License

MIT
