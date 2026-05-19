# @txfence/cli

Command-line interface for [txfence](https://github.com/AdityaChauhanX07/txfence). Drives the same pipeline as the SDK: simulation, policy checks, dry-runs, submission, replay, intent execution, formal verification, and provenance.

## Installation

```bash
npm install -g @txfence/cli
# or use one-off
npx @txfence/cli init
```

A `txfence.config.ts` in the working directory wires up chains, adapters, RPC URLs, signer, and the base policy. Run `txfence init` to scaffold one.

## Commands

```bash
# Setup and receipts
txfence init                                            # scaffold txfence.config.ts
txfence receipt --store ./receipts.jsonl [--filter chain=ethereum]

# Policy and simulation
txfence simulate         --kind transfer --chain ethereum --to 0x... --token ETH --amount 1e18
txfence check-policy     --kind transfer --chain ethereum --to 0x... --token ETH --amount 1e18
txfence submit           --kind transfer --chain ethereum --to 0x... --token ETH --amount 1e18
txfence dry-run          --config ./txfence.config.ts --kind transfer --chain ethereum ...
txfence diff             --config-a ./current.ts --config-b ./proposed.ts --generate-actions

# Policy versioning and replay
txfence policy-snapshot  --config ./txfence.config.ts --label v3 --author alice
txfence replay           --audit-log ./audit.jsonl --config ./proposed.ts --only-changed

# Intent execution
txfence intent validate      --config ./txfence.config.ts --intent ./intent.json
txfence intent submit        --config ./txfence.config.ts --intent ./intent.json [--dry-run]
txfence intent fork-simulate --config ./txfence.config.ts --intent ./intent.json --from 0x... --chain ethereum

# Formal verification
txfence verify rolling-window  --config ./txfence.config.ts --agents 10 --transactions 20 --cap 50000 --window 3600000 --token USDC
txfence verify absolute-cap    --config ./txfence.config.ts --agents 10 --transactions 10 --cap 50000 --token USDC
txfence verify policy-contains --inner ./strict.ts --outer ./permissive.ts
txfence stress-test            --config ./txfence.config.ts --agents 10 --transactions 20

# Provenance
txfence provenance verify --chain ./provenance.jsonl
txfence provenance proof  --chain ./provenance.jsonl --hash <entryHash>
```

13 commands in total.

## CI-friendly exit codes

`txfence replay` exits non-zero if any historical transaction would be newly rejected under the proposed policy — drop it into CI as a policy regression gate.

`txfence verify` and `txfence stress-test` exit non-zero on counterexample / low survival rate, suitable for blocking PRs that weaken the policy.

Full project README: https://github.com/AdityaChauhanX07/txfence

## License

MIT
