"use client";

import { useState } from "react";
import { Clipboard, Check } from "lucide-react";

// ─── CTA ──────────────────────────────────────────────────────────────────────

export function CTA() {
  const [copied, setCopied] = useState(false);
  const [hoverStart, setHoverStart] = useState(false);
  const [hoverGithub, setHoverGithub] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText("npm install @txfence/core");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      style={{
        padding: "6rem 1.5rem",
        borderTop: "1px solid var(--color-border-primary)",
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
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
          Start building policy-gated agents.
        </h2>

        {/* Subline */}
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--color-text-tertiary)",
            lineHeight: 1.8,
            marginBottom: "2rem",
          }}
        >
          Self-hosted. MIT licensed. Runs on your infrastructure.
          <br />
          600+ tests. 14 packages. Production-ready.
        </p>

        {/* Actions row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
            justifyContent: "flex-start",
          }}
        >
          <a
            href="/docs"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--color-text-primary)",
              textDecoration: "none",
              border: `1px solid ${hoverStart ? "var(--color-text-tertiary)" : "var(--color-border-secondary)"}`,
              borderRadius: 6,
              padding: "0.5rem 1rem",
              transition: "border-color 0.15s ease",
            }}
            onMouseEnter={() => setHoverStart(true)}
            onMouseLeave={() => setHoverStart(false)}
          >
            get started →
          </a>

          <a
            href="https://github.com/AdityaChauhanX07/txfence"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: hoverGithub ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={() => setHoverGithub(true)}
            onMouseLeave={() => setHoverGithub(false)}
          >
            github ↗
          </a>
        </div>

        {/* Install snippet */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.75rem",
            border: "1px solid var(--color-border-primary)",
            borderRadius: 6,
            padding: "0.5rem 0.875rem",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--color-text-tertiary)",
            }}
          >
            $
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--color-text-secondary)",
            }}
          >
            npm install @txfence/core
          </span>
          <button
            onClick={handleCopy}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--color-text-tertiary)",
              display: "flex",
              alignItems: "center",
            }}
            aria-label="Copy install command"
          >
            {copied ? (
              <Check size={13} style={{ color: "var(--color-success)" }} />
            ) : (
              <Clipboard size={13} />
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
