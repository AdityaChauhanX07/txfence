"use client";

import { useRef, useEffect, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const LOG_LINES = [
  { time: "14:02:31.004", actor: "agent-a", text: "reads cap: $24,000 remaining",  highlight: false },
  { time: "14:02:31.089", actor: "agent-b", text: "reads cap: $24,000 remaining",  highlight: false },
  { time: "14:02:31.201", actor: "agent-a", text: "submits: $20,000 transfer",      highlight: false },
  { time: "14:02:31.203", actor: "agent-b", text: "submits: $20,000 transfer",      highlight: false },
  { time: "14:02:31.441", actor: "agent-a", text: "confirmed ✓",                    highlight: false },
  { time: "14:02:31.443", actor: "agent-b", text: "confirmed ✓",                    highlight: false },
  { time: "",             actor: "",         text: "",                               highlight: false },
  { time: "$44,000 spent", actor: "",        text: "against a $25,000 cap",         highlight: true  },
] as const;

// ─── Problem ──────────────────────────────────────────────────────────────────

export function Problem() {
  const logRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [showClose, setShowClose] = useState(false);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;

    let closeTimer: ReturnType<typeof setTimeout>;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          closeTimer = setTimeout(() => setShowClose(true), 120);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(closeTimer);
    };
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
            marginBottom: "3rem",
            lineHeight: 1.3,
          }}
        >
          Autonomous agents fail in ways that aren&apos;t obvious.
        </h2>

        {/* Log block */}
        <div
          ref={logRef}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "clamp(11px, 1.4vw, 13px)",
            lineHeight: 2,
          }}
        >
          {LOG_LINES.map((line, i) => {
            // Spacer
            if (i === 6) {
              return <div key={i} style={{ height: "0.75rem" }} />;
            }

            const delay = line.highlight ? i * 120 + 200 : i * 120;

            // Highlight line
            if (line.highlight) {
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    marginTop: "0.5rem",
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateY(0)" : "translateY(4px)",
                    transition: `opacity 0.35s ease ${delay}ms, transform 0.35s ease ${delay}ms`,
                  }}
                >
                  <span
                    style={{
                      color: "var(--color-amber)",
                      fontWeight: 600,
                      minWidth: 110,
                      flexShrink: 0,
                    }}
                  >
                    {line.time}
                  </span>
                  <span style={{ minWidth: 72, flexShrink: 0 }} />
                  <span style={{ color: "var(--color-text-tertiary)" }}>
                    {line.text}
                  </span>
                </div>
              );
            }

            // Normal line
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(4px)",
                  transition: `opacity 0.35s ease ${delay}ms, transform 0.35s ease ${delay}ms`,
                }}
              >
                <span
                  style={{
                    color: "var(--color-text-tertiary)",
                    minWidth: 110,
                    flexShrink: 0,
                  }}
                >
                  {line.time}
                </span>
                <span
                  style={{
                    color: "var(--color-text-tertiary)",
                    minWidth: 72,
                    flexShrink: 0,
                  }}
                >
                  {line.actor}
                </span>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  {line.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* Closing line */}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            marginTop: "2.5rem",
            opacity: showClose ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        >
          <span style={{ color: "var(--color-text-secondary)" }}>
            txfence prevents this
          </span>
          <span style={{ color: "var(--color-text-tertiary)" }}>
            {" "}·{"  "}cap locking, two-phase acquire/commit/release
          </span>
        </div>
      </div>
    </section>
  );
}
