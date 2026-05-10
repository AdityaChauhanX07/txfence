"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/ui/code-block";

// ─── Data ─────────────────────────────────────────────────────────────────────

const CHAINS = [
  {
    id: "evm",
    label: "EVM & L2s",
    chains: "Ethereum, Arbitrum, Optimism, Base",
    features: [
      "Tenderly deep simulation with full call traces, state diffs, and decoded logs",
      "eth_call fallback when Tenderly is not configured",
      "viem-based signing and broadcasting",
      "Contract metadata verification with bytecode hash pinning",
    ],
    code: `import { createAgent } from '@txfence/core'
import {
  simulateEvmAction,
  executeEvmAction,
  privateKeySigner
} from '@txfence/evm'

const agent = createAgent(
  { chains: ['ethereum'], policies: { /* ... */ }, signer },
  { ethereum: { simulate: simulateEvmAction } },
  { ethereum: 'https://ethereum.publicnode.com' },
  (action, chainId, rpcUrl, evalResult, sim) =>
    executeEvmAction(action, chainId, rpcUrl, signer, evalResult, sim)
)`,
  },
  {
    id: "solana",
    label: "Solana",
    chains: "Solana",
    features: [
      "Native Solana support using @solana/kit primitives",
      "Jupiter and aggregator compatible via pre-built transaction bytes",
      "ed25519 keypair signing with Web Crypto API",
      "SystemProgram transfers and instruction-level contract calls",
    ],
    code: `import { createAgent } from '@txfence/core'
import {
  simulateSolanaAction,
  executeSolanaAction,
  privateKeySolanaSignerFromBytes
} from '@txfence/solana'

const agent = createAgent(
  { chains: ['solana'], policies: { /* ... */ }, signer },
  { solana: { simulate: simulateSolanaAction } },
  { solana: 'https://api.mainnet-beta.solana.com' },
  (action, chainId, rpcUrl, evalResult, sim) =>
    executeSolanaAction(action, chainId, rpcUrl, signer, evalResult, sim)
)`,
  },
  {
    id: "cosmos",
    label: "Cosmos",
    chains: "Cosmos Hub, Osmosis",
    features: [
      "Cosmos Hub (cosmoshub-4) and Osmosis (osmosis-1) support",
      "StargateClient via @cosmjs for chain connectivity",
      "BIP39 mnemonic-based signing with DirectSecp256k1HdWallet",
      "IBC-ready architecture for cross-chain expansion",
    ],
    code: `import { createAgent } from '@txfence/core'
import {
  simulateCosmosAction,
  executeCosmosAction,
  createCosmosSignerFromMnemonic
} from '@txfence/cosmos'

const agent = createAgent(
  { chains: ['cosmoshub'], policies: { /* ... */ }, signer },
  { cosmoshub: { simulate: simulateCosmosAction } },
  { cosmoshub: 'https://rpc.cosmos.network' },
  (action, chainId, rpcUrl, evalResult, sim) =>
    executeCosmosAction(action, chainId, rpcUrl, signer, evalResult, sim)
)`,
  },
] as const;

type ChainId = (typeof CHAINS)[number]["id"];

// ─── ChainSupport ─────────────────────────────────────────────────────────────

export function ChainSupport() {
  const [activeId, setActiveId] = useState<ChainId>("evm");
  const [hoveredId, setHoveredId] = useState<ChainId | null>(null);
  const active = CHAINS.find((c) => c.id === activeId)!;

  return (
    <section style={{ padding: "6rem 1.5rem" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Headline */}
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
          One policy engine. Three ecosystems.
        </h2>

        {/* Subheadline */}
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--color-text-tertiary)",
            marginBottom: "2.5rem",
          }}
        >
          Same API. Same policy shape. Different chains.
        </p>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            gap: 0,
            marginBottom: "2.5rem",
            alignItems: "baseline",
          }}
        >
          {CHAINS.map((chain, i) => (
            <span key={chain.id} style={{ display: "flex", alignItems: "baseline" }}>
              <button
                onClick={() => setActiveId(chain.id)}
                onMouseEnter={() => setHoveredId(chain.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  color:
                    activeId === chain.id
                      ? "var(--color-text-primary)"
                      : hoveredId === chain.id
                      ? "var(--color-text-secondary)"
                      : "var(--color-text-tertiary)",
                  transition: "color 0.15s ease",
                }}
              >
                {chain.label}
              </button>
              {i < CHAINS.length - 1 && (
                <span
                  style={{
                    color: "var(--color-border-secondary)",
                    margin: "0 0.75rem",
                    userSelect: "none",
                  }}
                >
                  ·
                </span>
              )}
            </span>
          ))}
        </div>

        {/* Content — keyed so fade-in re-fires on tab change */}
        <div
          key={activeId}
          style={{ display: "flex", flexDirection: "column", gap: "2rem", animation: "fade-in 0.25s ease both" }}
        >
          {/* Features */}
          <div>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--color-text-secondary)",
                marginBottom: "1rem",
              }}
            >
              {active.label}
            </p>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                marginBottom: "1.25rem",
              }}
            >
              Supports: {active.chains}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {active.features.map((feature) => (
                <li
                  key={feature}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.8,
                  }}
                >
                  <span
                    style={{
                      color: "var(--color-text-tertiary)",
                      marginRight: "0.625rem",
                    }}
                  >
                    —
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Code block */}
          <CodeBlock code={active.code} language="typescript" filename="agent.ts" />
        </div>
      </div>
    </section>
  );
}
