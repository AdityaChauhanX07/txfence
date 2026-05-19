# @txfence/monitor

On-chain reconciliation monitor for txfence agents. Watches known agent addresses by scanning blocks and alerts when transactions appear on-chain that were not recorded in the receipt store.

## What it does

The monitor runs two independent reconciliation loops:

**Forward reconciliation** (on-chain → receipt store): scans new blocks for transactions sent from watched agent addresses. If a transaction appears on-chain but has no matching receipt in the store, the monitor fires an `onUnrecordedTransaction` event. This detects signing key compromise and out-of-band execution — transactions the agent did not record because it did not initiate them through the txfence pipeline.

**Reverse reconciliation** (receipt store → on-chain): periodically checks that receipts already recorded in the store still exist on-chain at the expected block. If a receipt's block number no longer matches — or the transaction is missing entirely — the monitor fires an `onReorgDetected` event.

## Events

### `UnrecordedTransactionEvent`

Fires when a transaction from a watched address has no matching receipt.

- `severity: 'warning'` — transaction seen for the first time, within the grace period
- `severity: 'critical'` — transaction has been unrecorded past the grace period

The grace period (default 30 seconds) exists to handle the natural delay between execution and receipt storage. A warning fires immediately on first detection. If the transaction is still unrecorded after the grace period elapses, a critical fires and the entry is removed from the pending map.

### `ReorgEvent`

Fires when a recorded receipt can no longer be confirmed on-chain, or was re-mined in a different block. This indicates a chain reorganization occurred after the receipt was stored.

## Checkpoint store

The checkpoint store persists the last scanned block and the pending (unrecorded) transaction map across restarts. Without it, the monitor would re-scan from the current block on every start and miss transactions from the gap.

Two implementations are provided:

- `createMemoryCheckpointStore()` — in-process, lost on restart. Suitable for testing.
- `createFileCheckpointStore(path)` — JSON file on disk, survives restarts.

For production distributed deployments, implement `CheckpointStore` against Redis or a database.

## Warning: block scanning is RPC-intensive

The monitor fetches every full block (with all transactions) in the watched range. On Ethereum mainnet with 12-second block times and `maxBlocksPerPoll: 5`, this is 5 `eth_getBlockByNumber` calls every 12 seconds per chain.

**Do not use a public node in production.** Public nodes (publicnode.com, cloudflare-eth.com) will rate-limit you. Use a dedicated endpoint with archive access:

- [Alchemy](https://www.alchemy.com/)
- [Infura](https://www.infura.io/)
- [QuickNode](https://www.quicknode.com/)

Keep `maxBlocksPerPoll` low (default: 5). Increasing it causes burst RPC traffic and risks hitting rate limits.

## Configuration

| Option | Default | Description |
|---|---|---|
| `pollIntervalMs` | `12000` | How often to scan for new blocks (ms) |
| `maxBlocksPerPoll` | `5` | Maximum blocks to scan per poll cycle |
| `gracePeriodMs` | `30000` | Time before an unrecorded tx escalates to critical (ms) |
| `reconcileIntervalMs` | `300000` | How often to run reverse reconciliation (ms) |

`reconcileIntervalMs` is intentionally much longer than `pollIntervalMs`. Reverse reconciliation queries the RPC for every recent receipt — it is heavier than forward scanning. 5-minute intervals are sufficient for detecting reorgs.

## Usage

```typescript
import { createMonitor, createFileCheckpointStore } from '@txfence/monitor'
import { createPgReceiptStore } from '@txfence/storage-pg'

const receiptStore = createPgReceiptStore(pool)
const checkpointStore = createFileCheckpointStore('./monitor-checkpoint.json')

const monitor = createMonitor({
  chains: ['ethereum', 'base'],
  agentAddresses: {
    ethereum: ['0xYOUR_AGENT_ADDRESS'],
    base: ['0xYOUR_AGENT_ADDRESS'],
  },
  rpcUrls: {
    ethereum: process.env.ALCHEMY_ETH_URL!,
    base: process.env.ALCHEMY_BASE_URL!,
  },
  receiptStore,
  checkpointStore,
  pollIntervalMs: 12000,
  maxBlocksPerPoll: 5,
  gracePeriodMs: 30000,
  onUnrecordedTransaction(event) {
    console.warn(`[${event.severity}] unrecorded tx ${event.txHash} from ${event.fromAddress}`)
    if (event.severity === 'critical') {
      // page on-call, freeze agent, rotate keys
    }
  },
  onCriticalTransaction(event) {
    // fires in addition to onUnrecordedTransaction for critical events
    alertOncall(event)
  },
  onReorgDetected(event) {
    console.warn(`reorg detected: ${event.txHash} was at block ${event.originalBlock}`)
  },
})

await monitor.start()

// check status at any time
console.log(monitor.status())

// graceful shutdown
process.on('SIGTERM', () => monitor.stop())
```

## Known limitations

- **EVM only in v1.** Solana and Cosmos monitoring is planned for a future release.
- **No gap detection on first run.** On first start with no checkpoint, the monitor begins from the current block. Transactions that occurred before the monitor was started are not retroactively checked. Initialize the checkpoint store with a historical start block if you need coverage from a specific point.

---

Full project README: https://github.com/AdityaChauhanX07/txfence

