# @txfence/cosmos

Cosmos chain adapter for [txfence](https://github.com/AdityaChauhanX07/txfence). Simulation, transaction building, signing, and broadcast across Cosmos Hub, Osmosis, and other CosmJS-compatible chains.

## Installation

```bash
npm install @txfence/cosmos @txfence/core
```

`@txfence/cosmos` depends on `@cosmjs/stargate`, `@cosmjs/proto-signing`, and `@cosmjs/encoding`.

## Quick start

```typescript
import { createAgent, type Policy } from '@txfence/core'
import {
  simulateCosmosAction,
  executeCosmosAction,
  createCosmosSignerFromMnemonic,
} from '@txfence/cosmos'

const signer = await createCosmosSignerFromMnemonic(
  process.env.MNEMONIC!,
  { chainId: 'cosmoshub-4', prefix: 'cosmos' },
)

const agent = createAgent(
  { chains: ['cosmoshub'], policies: policy, signer },
  { cosmoshub: { simulate: simulateCosmosAction } },
  { cosmoshub: 'https://cosmos-rpc.publicnode.com' },
  (action, chainId, rpcUrl, evaluation, simulation) =>
    executeCosmosAction(action, chainId, rpcUrl, signer, evaluation, simulation),
)
```

## Supported chains

`COSMOS_CHAIN_CONFIGS` ships built-in entries for:

- `cosmoshub` (Cosmos Hub, prefix `cosmos`)
- `osmosis`   (Osmosis, prefix `osmo`)

Use `isCosmosChain(chainId)` to gate Cosmos-specific code paths.

## Custom chain configuration

```typescript
import { createCosmosSignerFromMnemonic } from '@txfence/cosmos'

const signer = await createCosmosSignerFromMnemonic(mnemonic, {
  chainId:  'juno-1',
  prefix:   'juno',
  feeDenom: 'ujuno',
})
```

## Building transactions outside the pipeline

`buildCosmosTransaction()` returns a `CosmosSerializedTransaction` suitable for offline signing or external broadcast.

## Exports

- `simulateCosmosAction` — pre-flight simulation
- `buildCosmosTransaction`, `executeCosmosAction` — build and broadcast
- `createCosmosSignerFromMnemonic` — mnemonic-backed signer
- `isCosmosChain`, `COSMOS_CHAIN_CONFIGS`, `COSMOS_CHAIN_IDS`

Full project README: https://github.com/AdityaChauhanX07/txfence

## License

MIT
