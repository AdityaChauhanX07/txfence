"use client";

import { useRef, useEffect, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const FAILURE_MODES = [
  { mode: "slippage overrun",              protection: "full"    as const, detail: "enforced at signing — cannot execute if slippage would exceed declared bounds." },
  { mode: "cross-chain intent replay",     protection: "full"    as const, detail: "chain scoping at policy level — action on unlisted chain is blocked." },
  { mode: "execute-on-timeout",            protection: "full"    as const, detail: "cancel is the hard default — approval timeout means rejection, not execution." },
  { mode: "spend cap race condition",      protection: "full"    as const, detail: "two-phase acquire/commit/release cap locking prevents double-spend." },
  { mode: "simulation-execution div.",     protection: "partial" as const, detail: "output bounds limit damage. state_may_diverge caveat always flagged." },
  { mode: "unintended proxy target",       protection: "partial" as const, detail: "implementation hash pinning via metadata verification." },
  { mode: "stale allowlist",              protection: "partial" as const, detail: "contract metadata verification with expiry timestamps." },
  { mode: "gas estimation failure",        protection: "partial" as const, detail: "minimum buffer multiplier enforced (1.2x default)." },
] satisfies Array<{ mode: string; protection: "full" | "partial"; detail: string }>;

// ─── FailureGrid ──────────────────────────────────────────────────────────────

export function FailureGrid() {
  const tableRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
          What txfence protects against
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
          8 documented failure modes. Full or partial protection for each.
        </p>

        {/* Column headers */}
        <div
          style={{
            display: "flex",
            marginBottom: "0.75rem",
            paddingBottom: "0.75rem",
            borderBottom: "1px solid var(--color-border-primary)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              flex: 1,
            }}
          >
            failure mode
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              minWidth: 72,
              textAlign: "right",
            }}
          >
            protection
          </span>
        </div>

        {/* Rows */}
        <div ref={tableRef}>
          {FAILURE_MODES.map((item, i) => (
            <div
              key={item.mode}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                display: "flex",
                padding: "0.625rem 0",
                borderBottom: "1px solid var(--color-border-primary)",
                gap: "1.5rem",
                alignItems: "baseline",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(3px)",
                transition: `opacity 0.3s ease ${i * 60}ms, transform 0.3s ease ${i * 60}ms`,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color:
                    hoveredIndex === i
                      ? "var(--color-text-primary)"
                      : "var(--color-text-secondary)",
                  flex: 1,
                  transition: "color 0.15s ease",
                }}
              >
                {item.mode}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  minWidth: 72,
                  textAlign: "right",
                  color:
                    item.protection === "full"
                      ? "var(--color-success)"
                      : "var(--color-amber)",
                }}
              >
                {item.protection}
              </span>
            </div>
          ))}
        </div>

        {/* Closing note */}
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-text-tertiary)",
            marginTop: "1.5rem",
          }}
        >
          full — enforced unconditionally · partial — bounded by simulation accuracy
        </p>
      </div>
    </section>
  );
}
