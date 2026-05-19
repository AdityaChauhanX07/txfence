# @txfence/react

React hooks for [txfence](https://github.com/AdityaChauhanX07/txfence). Build operator UIs and approval dashboards on top of an `Agent` without re-implementing the pipeline state machine in component code.

## Installation

```bash
npm install @txfence/react @txfence/core react
```

`react` is a peer dependency (`^18.0.0`).

## Quick start

```tsx
import { useAgent, useSubmit } from '@txfence/react'

function TransferButton({ to, amount }) {
  const agent = useAgent({ config, adapters, rpcUrls, executor })
  const { submit, state } = useSubmit(agent)

  return (
    <button
      disabled={state.status === 'pending'}
      onClick={() => submit({
        action: { kind: 'transfer', chain: 'ethereum', to, token: amount },
        policy,
      })}
    >
      {state.status === 'success' ? 'Sent' : 'Send'}
    </button>
  )
}
```

## Hooks

| Hook | Returns |
|---|---|
| `useAgent(options)` | A memoized `Agent` instance constructed from config. |
| `useSimulate(agent)` | `{ simulate, state }` — pre-flight only, never broadcasts. |
| `useSubmit(agent)` | `{ submit, state }` — full pipeline. |
| `useDryRun(agent)` | `{ dryRun, state }` — runs everything except signing. |
| `useIntentSubmit(agent)` | Submits multi-step intents and tracks per-step status. |
| `useReceipt(agent, txHash)` | Subscribes to a previously confirmed receipt. |
| `useAgentHealth(agent, options)` | Polls `agent.health()` for Kubernetes-probe-style UIs. |

Each hook exposes a discriminated-union state — `idle`, `pending`, `success`, `error` — so components can switch on `state.status` without writing boilerplate.

## Strict mode + concurrent rendering

The hooks are safe under React 18 strict mode. In-flight submissions are tied to a ref so a remount does not double-submit; the second render reuses the existing promise.

Full project README: https://github.com/AdityaChauhanX07/txfence

## License

MIT
