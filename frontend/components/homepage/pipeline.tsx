"use client";

import { useRef, useEffect, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  {
    name: "policy check",
    detail: "six checks. any failure stops here.",
    note: "chain · spend cap · allowlist · slippage · gas buffer · simulation required",
    optional: false,
  },
  {
    name: "simulation",
    detail: "eth_call or tenderly. would it revert?",
    note: "gas estimate · coverage level · caveats · block on revert",
    optional: false,
  },
  {
    name: "human approval",
    detail: "optional. webhook + HMAC. cancel on timeout.",
    note: "above threshold only · HMAC-signed payload · cancel is the hard default",
    optional: true,
  },
  {
    name: "execution",
    detail: "signed. broadcast. receipt stored.",
    note: "audit log recorded · monitor reconciled · receipt stored",
    optional: false,
  },
] as const;

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export function Pipeline() {
  const railRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = railRef.current;
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
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
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
          Every transaction goes through the fence.
        </h2>

        {/* Subheadline */}
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--color-text-tertiary)",
            marginBottom: "3.5rem",
          }}
        >
          Four stages. Every transaction. No exceptions.
        </p>

        {/* Railroad */}
        <div ref={railRef} style={{ position: "relative", paddingLeft: 28 }}>
          {/* Track background */}
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 0,
              bottom: 0,
              width: 1,
              background: "var(--color-border-primary)",
            }}
          />
          {/* Track fill — draws downward on scroll */}
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 0,
              bottom: 0,
              width: 1,
              background: "var(--color-border-secondary)",
              transformOrigin: "top",
              transform: visible ? "scaleY(1)" : "scaleY(0)",
              transition: "transform 1.2s var(--ease-out-expo)",
            }}
          />

          {/* Stages */}
          {STAGES.map((stage, i) => (
            <div
              key={stage.name}
              style={{
                position: "relative",
                paddingBottom: i === STAGES.length - 1 ? 0 : "2.5rem",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(4px)",
                transition: `opacity 0.4s ease ${i * 180}ms, transform 0.4s ease ${i * 180}ms`,
              }}
            >
              {/* Dot */}
              <div
                style={{
                  position: "absolute",
                  left: -28,
                  top: 4,
                  width: 13,
                  height: 13,
                  borderRadius: "50%",
                  background: "var(--color-bg-primary)",
                  border: `1px solid ${stage.optional ? "var(--color-border-primary)" : "var(--color-border-secondary)"}`,
                }}
              />

              {/* Name */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                }}
              >
                {stage.name}
                {stage.optional && (
                  <span
                    style={{
                      color: "var(--color-text-tertiary)",
                      fontWeight: 400,
                      marginLeft: "0.5rem",
                    }}
                  >
                    optional
                  </span>
                )}
              </div>

              {/* Detail */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  marginTop: "0.25rem",
                }}
              >
                {stage.detail}
              </div>

              {/* Note */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--color-text-tertiary)",
                  marginTop: "0.375rem",
                  lineHeight: 1.6,
                }}
              >
                {stage.note}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
