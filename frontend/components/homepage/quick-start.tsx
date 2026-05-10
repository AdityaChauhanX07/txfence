import { CodeBlock } from "@/components/ui/code-block";

// ─── Code sample ──────────────────────────────────────────────────────────────

const quickStartCode = `import { createAgent } from '@txfence/core'
import { simulateEvmAction, executeEvmAction, privateKeySigner } from '@txfence/evm'

const signer = privateKeySigner(process.env.PRIVATE_KEY as \`0x\${string}\`)

const agent = createAgent(
  {
    chains: ['ethereum'],
    policies: {
      chains:                 ['ethereum'],
      maxSpendPerTx:          { token: 'USDC', amount: 1000n, decimals: 6 },
      allowedContracts:       [{ address: '0xYOUR_CONTRACT', chain: 'ethereum' }],
      requireSimulation:      true,
      gasBufferMultiplier:    1.2,
      humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },
      humanApprovalTimeoutMs: 30000,
      capLockMode:            'per-agent',
    },
    signer,
  },
  { ethereum: { simulate: simulateEvmAction } },
  { ethereum: 'https://ethereum.publicnode.com' },
  (action, chainId, rpcUrl, evaluation, simulation) =>
    executeEvmAction(action, chainId, rpcUrl, signer, evaluation, simulation)
)

const result = await agent.submit({
  action: {
    kind:  'transfer',
    chain: 'ethereum',
    token: { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
    to:    '0xRECIPIENT',
  },
  policy: agent.config.policies,
})

switch (result.status) {
  case 'success':
    console.log('tx hash:', result.receipt.txHash)
    break
  case 'policy_rejected':
    console.log('rejected:', result.evaluation.rejectionReason)
    break
  case 'simulation_failed':
    console.log('simulation failed:', result.simulation.caveats)
    break
  case 'approval_timeout':
    console.log('approval required above threshold')
    break
  case 'execution_failed':
    console.log('failed:', result.reason)
    break
}`;

// ─── QuickStart ───────────────────────────────────────────────────────────────

export function QuickStart() {
  return (
    <section style={{ padding: "6rem 1.5rem" }}>
      <style>{".qs-docs-link:hover { color: var(--color-text-secondary); }"}</style>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(1.5rem, 3vw, 2rem)",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            marginBottom: "0.75rem",
            lineHeight: 1.3,
          }}
        >
          Three lines to a policy-gated agent.
        </h2>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--color-text-tertiary)",
            marginBottom: "2rem",
          }}
        >
          Set your policies. Submit actions. txfence handles the rest.
        </p>

        <CodeBlock code={quickStartCode} language="typescript" filename="quick-start.ts" />

        <a
          href="/docs"
          className="qs-docs-link"
          style={{
            display: "inline-block",
            marginTop: "1.5rem",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--color-text-tertiary)",
            textDecoration: "none",
            transition: "color 0.15s ease",
          }}
        >
          read the full documentation →
        </a>
      </div>
    </section>
  );
}
