# @txfence/solana

Solana chain adapter for [txfence](https://github.com/AdityaChauhanX07/txfence). Simulation, transaction building, signing, and broadcast against Solana mainnet, devnet, and testnet.

## Installation

```bash
npm install @txfence/solana @txfence/core @solana/kit
```

## Quick start

```typescript
import { createAgent, type Policy } from '@txfence/core'
import {
  simulateSolanaAction,
  executeSolanaAction,
  privateKeySolanaSignerFromBytes,
} from '@txfence/solana'

const signer = privateKeySolanaSignerFromBytes(secretKeyBytes)

const agent = createAgent(
  { chains: ['solana-mainnet'], policies: policy, signer },
  { 'solana-mainnet': { simulate: simulateSolanaAction } },
  { 'solana-mainnet': 'https://api.mainnet-beta.solana.com' },
  (action, chainId, rpcUrl, evaluation, simulation) =>
    executeSolanaAction(action, chainId, rpcUrl, signer, evaluation, simulation),
)
```

## Supported chains

- `solana-mainnet`
- `solana-devnet`
- `solana-testnet`

Use `isSolanaChain(chainId)` to gate Solana-specific code paths.

## Building transactions outside the pipeline

`buildSolanaTransaction()` produces a `SolanaSerializedTransaction` suitable for offline signing or external broadcast:

```typescript
import { buildSolanaTransaction } from '@txfence/solana'

const tx = await buildSolanaTransaction(action, 'solana-mainnet', rpcUrl, fromAddress)
```

## Signer

`SolanaSigner` mirrors the EVM `Signer` shape. `privateKeySolanaSignerFromBytes` wraps a 64-byte ed25519 keypair; bring your own custodial or HSM signer by implementing the `SolanaSigner` interface.

## Exports

- `simulateSolanaAction` — pre-flight simulation
- `buildSolanaTransaction`, `executeSolanaAction` — build and broadcast
- `privateKeySolanaSignerFromBytes` — keypair-backed signer
- `isSolanaChain`, `SolanaChainId` — chain id helpers

Full project README: https://github.com/AdityaChauhanX07/txfence

## License

MIT
