"use client";

import { useEffect, useState } from "react";
import { Clipboard, Check } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMAND = "$ npx txfence submit --kind transfer --chain ethereum";

const OUTPUT_LINES = [
  { prefix: "policy  ", label: "chain allowed",             status: "pass" },
  { prefix: "policy  ", label: "within spend cap",          status: "pass" },
  { prefix: "policy  ", label: "contract on allowlist",     status: "pass" },
  { prefix: "simulate", label: "no revert detected",        status: "pass" },
  { prefix: "approve ", label: "below threshold, skipping", status: "skip" },
  { prefix: "execute ", label: "0x4a3f…c291",               status: "done" },
] as const;

// ─── Typewriter hook ──────────────────────────────────────────────────────────

function useTypewriter(text: string, speed: number, startDelay: number) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let index = 0;

    const type = () => {
      if (cancelled) return;
      if (index < text.length) {
        index++;
        setDisplayed(text.slice(0, index));
        timer = setTimeout(type, speed);
      } else {
        setDone(true);
      }
    };

    timer = setTimeout(type, startDelay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

// ─── OutputLine ───────────────────────────────────────────────────────────────

type LineStatus = "pass" | "skip" | "done";

interface OutputLineProps {
  prefix: string;
  label: string;
  status: LineStatus;
  visible: boolean;
}

function OutputLine({ prefix, label, status, visible }: OutputLineProps) {
  const symbol = status === "skip" ? "—" : "✓";
  const symbolColor =
    status === "skip" ? "var(--color-text-tertiary)" : "var(--color-success)";
  const labelColor =
    status === "skip" ? "var(--color-text-tertiary)" : "var(--color-text-secondary)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        fontFamily: "var(--font-mono)",
        fontSize: "clamp(11px, 1.4vw, 13px)",
        lineHeight: 1.8,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
      }}
    >
      <span style={{ color: "var(--color-text-tertiary)", minWidth: "5.5em" }}>
        {prefix}
      </span>
      <span style={{ color: symbolColor, minWidth: "1.5em" }}>{symbol}</span>
      <span style={{ color: labelColor }}>{label}</span>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export function Hero() {
  const { displayed, done: commandDone } = useTypewriter(COMMAND, 26, 300);
  const [visibleLines, setVisibleLines] = useState<boolean[]>(Array(6).fill(false));
  const [showMeta, setShowMeta] = useState(false);
  const [cursorDone, setCursorDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hoverStart, setHoverStart] = useState(false);
  const [hoverGithub, setHoverGithub] = useState(false);
  const [hoverSnippet, setHoverSnippet] = useState(false);

  useEffect(() => {
    if (!commandDone) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => setCursorDone(true), 900));

    OUTPUT_LINES.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setVisibleLines((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }, 500 + i * 160)
      );
    });

    timers.push(setTimeout(() => setShowMeta(true), 500 + 6 * 160 + 200));

    return () => timers.forEach(clearTimeout);
  }, [commandDone]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText("npm install @txfence/core");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cursor = cursorDone ? null : (
    <span
      style={{
        display: "inline-block",
        width: 2,
        height: "1em",
        background: "var(--color-text-secondary)",
        verticalAlign: "text-bottom",
        marginLeft: 2,
        animation: commandDone
          ? "cursor-blink 0.5s ease 2"
          : "cursor-blink 0.7s ease infinite",
      }}
    />
  );

  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "6rem 1.5rem 4rem",
      }}
    >
      {/* Wordmark */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
          marginBottom: "3.5rem",
          animation: "fade-in 0.6s ease both",
        }}
      >
        txfence
      </div>

      {/* Terminal block */}
      <div style={{ width: "100%", maxWidth: 560 }}>
        {/* Command line */}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "clamp(12px, 1.6vw, 14px)",
            color: "var(--color-text-primary)",
            lineHeight: 1.6,
            marginBottom: "1.25rem",
            minHeight: "1.6em",
          }}
        >
          {displayed}
          {cursor}
        </div>

        {/* Output lines */}
        <div style={{ marginBottom: "2.5rem" }}>
          {OUTPUT_LINES.map((line, i) => (
            <OutputLine
              key={line.label}
              prefix={line.prefix}
              label={line.label}
              status={line.status}
              visible={visibleLines[i]}
            />
          ))}
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "var(--color-border-primary)",
            marginBottom: "2rem",
            opacity: showMeta ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        />

        {/* Meta block */}
        <div
          style={{
            opacity: showMeta ? 1 : 0,
            transform: showMeta ? "translateY(0)" : "translateY(4px)",
            transition: "opacity 0.4s ease 100ms, transform 0.4s ease 100ms",
          }}
        >
          {/* Tagline */}
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              lineHeight: 1.6,
              marginBottom: "1.25rem",
            }}
          >
            <span style={{ color: "var(--color-text-secondary)" }}>
              The policy layer for autonomous agents.
            </span>
            <span style={{ color: "var(--color-text-tertiary)" }}>
              {" "}Simulation, spending controls, and human-in-the-loop — as
              first-class primitives.
            </span>
          </p>

          {/* Actions row */}
          <div
            style={{
              display: "flex",
              gap: "1.25rem",
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: "1.25rem",
            }}
          >
            {/* Get started */}
            <a
              href="/docs"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--color-text-secondary)",
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

            {/* GitHub */}
            <a
              href="https://github.com/AdityaChauhanX07/txfence"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: hoverGithub
                  ? "var(--color-text-secondary)"
                  : "var(--color-text-tertiary)",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={() => setHoverGithub(true)}
              onMouseLeave={() => setHoverGithub(false)}
            >
              github ↗
            </a>

            {/* Install snippet */}
            <div
              style={{
                marginLeft: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--color-text-secondary)",
                border: `1px solid ${hoverSnippet ? "var(--color-border-secondary)" : "var(--color-border-primary)"}`,
                borderRadius: 6,
                padding: "0.375rem 0.75rem",
                transition: "border-color 0.15s ease",
              }}
              onMouseEnter={() => setHoverSnippet(true)}
              onMouseLeave={() => setHoverSnippet(false)}
            >
              <span style={{ color: "var(--color-text-tertiary)" }}>$</span>
              <span>npm install @txfence/core</span>
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
                  <Check size={12} style={{ color: "var(--color-success)" }} />
                ) : (
                  <Clipboard size={12} />
                )}
              </button>
            </div>
          </div>

          {/* Version line */}
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-text-tertiary)",
            }}
          >
            v0.46.0 · 600+ tests passing · MIT · CI green
          </p>
        </div>
      </div>
    </section>
  );
}
