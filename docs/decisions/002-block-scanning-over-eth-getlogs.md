# Use block scanning (getBlock with includeTransactions) over eth_getLogs for monitor

**Status:** Accepted
**Date:** May 2026

## Context

The `@txfence/monitor` package needs to detect all transactions from known agent addresses, including plain ETH transfers that do not emit logs. Two approaches were considered:

1. `eth_getLogs` with address filter — only catches transactions that emit logs. Misses plain ETH transfers entirely.
2. `getBlock({ includeTransactions: true })` — fetches all transactions in each block and filters by address in application code. Heavier on RPC calls but complete.

## Decision

Use block scanning. The monitor exists specifically to detect signing key compromise or out-of-band execution. A plain ETH transfer from a compromised key would be missed entirely by `eth_getLogs`, which is exactly the failure mode the monitor exists to catch. Completeness is non-negotiable. The RPC cost is mitigated by the `maxBlocksPerPoll` setting and documented clearly in the README.

## Consequences

**Positive:** catches all transaction types including plain ETH transfers — no gaps in coverage.

**Negative:** RPC-intensive. Public nodes will rate-limit under continuous polling. Requires dedicated RPC endpoints (Alchemy, Infura) in production. Documented prominently in both the package README and the root README.
