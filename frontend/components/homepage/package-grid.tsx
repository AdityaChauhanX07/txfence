"use client";

import { useState, useRef, useEffect } from "react";
import { Clipboard, Check } from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

type PkgTag = "Core" | "Chain" | "Infra" | "Tooling" | "Dev";

interface Pkg {
  name: string;
  role: string;
  tag: PkgTag;
  noInstall?: boolean;
  dashed?: boolean;
}

const PACKAGES: Pkg[] = [
  {
    name: "@txfence/core",
    role: "Policy engine, agent orchestration, cap locking, receipt storage, webhook approval",
    tag: "Core",
  },
  {
    name: "@txfence/evm",
    role: "EVM chain adapter with Tenderly deep simulation (Ethereum, Arbitrum, Optimism, Base)",
    tag: "Chain",
  },
  {
    name: "@txfence/solana",
    role: "Solana chain adapter with Jupiter and aggregator compatibility",
    tag: "Chain",
  },
  {
    name: "@txfence/cosmos",
    role: "Cosmos chain adapter (Cosmos Hub, Osmosis), IBC-ready",
    tag: "Chain",
  },
  {
    name: "@txfence/redis",
    role: "Redis-backed cap lock provider with atomic Lua scripts for multi-agent environments",
    tag: "Infra",
  },
  {
    name: "@txfence/storage-pg",
    role: "PostgreSQL receipt storage with idempotent upserts and indexed queries",
    tag: "Infra",
  },
  {
    name: "@txfence/storage-sqlite",
    role: "SQLite receipt storage for local development and single-process staging",
    tag: "Infra",
  },
  {
    name: "@txfence/audit",
    role: "Append-only audit log capturing every policy decision, rejection, and execution outcome",
    tag: "Tooling",
  },
  {
    name: "@txfence/monitor",
    role: "On-chain reconciliation monitor — detects unrecorded transactions and chain reorgs",
    tag: "Tooling",
  },
  {
    name: "@txfence/verify",
    role: "Formal policy verification — bounded model checking, counterexample generation, and adversarial stress testing",
    tag: "Tooling",
  },
  {
    name: "@txfence/provenance",
    role: "Cryptographic provenance chains with hash chaining, Merkle proofs, and tamper-evident audit trails",
    tag: "Tooling",
  },
  {
    name: "@txfence/mcp",
    role: "MCP server exposing txfence as tools for any MCP-compatible AI assistant",
    tag: "Tooling",
  },
  {
    name: "@txfence/cli",
    role: "Command-line interface: simulate, submit, diff, and check policies from the terminal",
    tag: "Tooling",
  },
  {
    name: "@txfence/react",
    role: "React hooks (useAgent, useSubmit) for building frontends on top of txfence agents",
    tag: "Tooling",
  },
  {
    name: "@txfence/integration",
    role: "Anvil integration tests and more packages in development",
    tag: "Dev",
    noInstall: true,
    dashed: true,
  },
];

// ─── PackageGrid ──────────────────────────────────────────────────────────────

export function PackageGrid() {
  const listRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleCopy = async (i: number, name: string) => {
    await navigator.clipboard.writeText(`npm install ${name}`);
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

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
          17 packages. One mission.
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
          Everything you need to deploy policy-gated autonomous agents across chains.
        </p>

        {/* Package list */}
        <div ref={listRef}>
          {PACKAGES.map((pkg, i) => {
            const isHovered = hoveredIndex === i;
            const isCopied = copiedIndex === i;
            const showInstall = isHovered && !pkg.noInstall;

            return (
              <div
                key={pkg.name}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  padding: "0.75rem 0",
                  borderBottom: "1px solid var(--color-border-primary)",
                  borderTop: i === 0 ? "1px solid var(--color-border-primary)" : undefined,
                  cursor: "default",
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(3px)",
                  transition: `opacity 0.3s ease ${i * 40}ms, transform 0.3s ease ${i * 40}ms`,
                }}
              >
                {/* Line 1: name + tag */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "1rem",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      color: pkg.dashed
                        ? "var(--color-text-tertiary)"
                        : isHovered
                        ? "var(--color-text-primary)"
                        : "var(--color-text-secondary)",
                      transition: "color 0.15s ease",
                    }}
                  >
                    {pkg.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--color-text-tertiary)",
                      flexShrink: 0,
                    }}
                  >
                    {pkg.tag}
                  </span>
                </div>

                {/* Line 2: role */}
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--color-text-tertiary)",
                    marginTop: "0.25rem",
                    lineHeight: 1.6,
                  }}
                >
                  {pkg.role}
                </div>

                {/* Line 3: install command on hover */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginTop: showInstall ? "0.375rem" : 0,
                    opacity: showInstall ? 1 : 0,
                    transform: showInstall ? "translateY(0)" : "translateY(2px)",
                    transition: "opacity 0.2s ease, transform 0.2s ease",
                    pointerEvents: showInstall ? "auto" : "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--color-text-tertiary)",
                    }}
                  >
                    npm install {pkg.name}
                  </span>
                  <button
                    onClick={() => handleCopy(i, pkg.name)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      color: "var(--color-text-tertiary)",
                      display: "flex",
                      alignItems: "center",
                    }}
                    aria-label={`Copy npm install ${pkg.name}`}
                  >
                    {isCopied ? (
                      <Check size={11} style={{ color: "var(--color-success)" }} />
                    ) : (
                      <Clipboard size={11} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
