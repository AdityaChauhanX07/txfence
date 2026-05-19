// Instruments — heatmap, chains, audit, vitals, sparkline.
const { useEffect, useRef, useState, useMemo } = React;

// ─── Heatmap ─────────────────────────────────────────────────────────────────
// Grid: kinds (rows) × amount-USD-buckets (cols). Each cell = pass-rate.
const AMOUNT_BUCKETS = [
  { lo: 0,      hi: 50,     label: "<50" },
  { lo: 50,     hi: 250,    label: "<250" },
  { lo: 250,    hi: 1000,   label: "<1k" },
  { lo: 1000,   hi: 5000,   label: "<5k" },
  { lo: 5000,   hi: 25000,  label: "<25k" },
  { lo: 25000,  hi: 1e9,    label: "≥25k" },
];

function passRate(policy, kind, bucket) {
  // sample 20 actions in the bucket and check how many pass policy gate
  let pass = 0; const N = 20;
  for (let i = 0; i < N; i++) {
    const usd = bucket.lo + Math.random() * (bucket.hi - bucket.lo);
    const token = "USDC";
    const amount = usd / window.toUSD(1, token);
    const known = ["0xe592427a0aece92de3edee1f18e0157c05861564", "0x111111125421ca6dc452d289314280a0f8842a65"];
    const to = (kind === "transfer") ? "0xdead" :
      Math.random() < 0.7 ? known[0] : "0x" + Array.from({length:40},()=>Math.floor(Math.random()*16).toString(16)).join("");
    const action = { kind, chain: policy.chain, token, amount, toAddress: to, maxSlippage: kind === "swap" ? 50 : 0 };
    const r = window.evaluate(policy, action);
    if (r.finalStatus !== "rejected" && r.finalStatus !== "reverted") pass++;
  }
  return pass / N;
}

function Heatmap({ policy, pulse }) {
  const grid = useMemo(() => {
    return window.KINDS_ALL.map(kind =>
      AMOUNT_BUCKETS.map(b => passRate(policy, kind, b))
    );
  }, [policy]);

  return (
    <div className="panel" style={{ padding: 0 }}>
      <div className="panel-head">
        <span>policy heatmap</span>
        <span className="live-pip">live</span>
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--t-3)", marginBottom: 10, letterSpacing: "0.04em",
        }}>
          pass-rate × kind ÷ size · re-shapes as you tune policy
        </div>
        {/* column labels */}
        <div style={{ display: "grid", gridTemplateColumns: "5.5rem repeat(6, 1fr)", gap: 4, marginBottom: 6 }}>
          <div></div>
          {AMOUNT_BUCKETS.map(b => (
            <div key={b.label} style={{
              fontFamily: "var(--font-mono)", fontSize: 9,
              color: "var(--t-3)", textAlign: "center", letterSpacing: "0.06em",
            }}>{b.label}</div>
          ))}
        </div>
        {/* rows */}
        {window.KINDS_ALL.map((kind, ri) => (
          <div key={kind} style={{ display: "grid", gridTemplateColumns: "5.5rem repeat(6, 1fr)", gap: 4, marginBottom: 4 }}>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 10,
              color: "var(--t-2)", letterSpacing: "0.04em",
              display: "flex", alignItems: "center",
            }}>{kind}</div>
            {AMOUNT_BUCKETS.map((b, ci) => {
              const r = grid[ri][ci];
              // shade: red→amber→green
              const hue = 145 * r + 8 * (1 - r);
              const light = 0.16 + 0.32 * r;
              const bg = `oklch(${light} 0.07 ${hue})`;
              const isHot = pulse && pulse.kind === kind && pulse.bucket === ci;
              return (
                <div key={ci} style={{
                  height: 26,
                  background: bg,
                  borderRadius: 3,
                  position: "relative",
                  border: isHot ? "1px solid rgba(255,255,255,0.45)" : "1px solid transparent",
                  transition: "background 0.6s var(--ease-out-expo), border-color 0.4s",
                }}>
                  <span style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-mono)", fontSize: 9,
                    color: r > 0.55 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)",
                    letterSpacing: "0.02em",
                  }}>{Math.round(r*100)}</span>
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-3)" }}>blocked</span>
          <div style={{ display: "flex", gap: 2 }}>
            {Array.from({length: 12}, (_, i) => {
              const r = i / 11; const hue = 145*r + 8*(1-r); const light = 0.16 + 0.32*r;
              return <div key={i} style={{ width: 10, height: 6, background: `oklch(${light} 0.07 ${hue})`, borderRadius: 1 }} />;
            })}
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-3)" }}>passing</span>
        </div>
      </div>
    </div>
  );
}

// ─── Chain Pulse ─────────────────────────────────────────────────────────────
const CHAIN_LAYOUT = [
  { id: "ethereum",   x: 0.25, y: 0.30 },
  { id: "arbitrum",   x: 0.55, y: 0.18 },
  { id: "optimism",   x: 0.75, y: 0.40 },
  { id: "base",       x: 0.50, y: 0.52 },
  { id: "solana",     x: 0.20, y: 0.65 },
  { id: "cosmoshub",  x: 0.60, y: 0.78 },
  { id: "osmosis",    x: 0.85, y: 0.72 },
];

function ChainPulse({ policy, pulses }) {
  // pulses: { ethereum: timestamp, ... }
  const wrapRef = useRef(null);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force(x => (x+1) % 1e6), 80);
    return () => clearInterval(id);
  }, []);

  const now = performance.now();
  const policyChain = policy.chain;

  return (
    <div className="panel" style={{ padding: 0 }}>
      <div className="panel-head">
        <span>chain pulse</span>
        <span className="live-pip">live</span>
      </div>
      <div ref={wrapRef} style={{ padding: 16, height: 220, position: "relative" }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{
          position: "absolute", inset: 16, width: "calc(100% - 32px)", height: "calc(100% - 32px)",
        }}>
          {/* faint connections */}
          {CHAIN_LAYOUT.flatMap((a, i) =>
            CHAIN_LAYOUT.slice(i+1).map((b, j) => (
              <line key={`${i}-${j}`}
                x1={a.x*100} y1={a.y*100} x2={b.x*100} y2={b.y*100}
                stroke="var(--line-0)" strokeWidth="0.18" />
            ))
          )}
        </svg>
        {CHAIN_LAYOUT.map(c => {
          const last = pulses[c.id] || 0;
          const dt = now - last;
          const active = dt < 1500;
          const alpha = active ? 1 - dt/1500 : 0;
          const isPolicy = c.id === policyChain;
          return (
            <div key={c.id} style={{
              position: "absolute",
              left: `calc(${c.x*100}% - 6px)`,
              top:  `calc(${c.y*100}% - 6px)`,
              width: 12, height: 12,
            }}>
              {/* pulse ring */}
              <div style={{
                position: "absolute",
                left: -8, top: -8, width: 28, height: 28,
                borderRadius: "50%",
                border: "1px solid var(--ok)",
                opacity: alpha * 0.6,
                transform: `scale(${1 + (1 - alpha) * 0.6})`,
                transition: "opacity 0.1s linear",
                pointerEvents: "none",
              }}/>
              {/* node */}
              <div style={{
                width: 12, height: 12,
                borderRadius: "50%",
                background: active ? "var(--ok)" : "var(--bg-3)",
                border: `1px solid ${isPolicy ? "var(--t-1)" : "var(--line-2)"}`,
                boxShadow: active ? `0 0 10px var(--ok)` : "none",
                transition: "background 0.4s, box-shadow 0.4s",
              }}/>
              <div style={{
                position: "absolute", top: 16,
                left: "50%", transform: "translateX(-50%)",
                fontFamily: "var(--font-mono)", fontSize: 9,
                color: isPolicy ? "var(--t-1)" : "var(--t-3)",
                whiteSpace: "nowrap", letterSpacing: "0.04em",
              }}>{c.id}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Audit Stream ────────────────────────────────────────────────────────────
function AuditStream({ rows }) {
  const ref = useRef(null);
  return (
    <div className="panel" style={{ padding: 0, display: "flex", flexDirection: "column" }}>
      <div className="panel-head">
        <span>audit · tail -f</span>
        <span className="live-pip">live</span>
      </div>
      <div style={{
        padding: "8px 12px", height: 220,
        overflow: "hidden", position: "relative",
        maskImage: "linear-gradient(180deg, transparent, black 12%, black 88%, transparent)",
      }}>
        <div ref={ref} style={{ display: "flex", flexDirection: "column-reverse" }}>
          {rows.slice(0, 25).map((r, i) => {
            const c = r.result.finalStatus === "executed" ? "var(--ok)"
              : r.result.finalStatus === "approval" ? "var(--warn)" : "var(--bad)";
            const sym = r.result.finalStatus === "executed" ? "✓"
              : r.result.finalStatus === "approval" ? "~" : "✗";
            const opacity = Math.max(0.18, 1 - i * 0.075);
            return (
              <div key={r.id} style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: "var(--t-3)", padding: "1.5px 0",
                opacity, transition: "opacity 0.4s",
                display: "flex", gap: 8, whiteSpace: "nowrap", overflow: "hidden",
              }}>
                <span>{r.t}</span>
                <span style={{ color: c, width: 8 }}>{sym}</span>
                <span style={{ color: "var(--t-2)", flex: "0 0 auto" }}>{r.action.kind.padEnd(13)}</span>
                <span style={{ color: "var(--t-2)" }}>{String(r.action.amount).padStart(7)} {r.action.token}</span>
                <span style={{ color: "var(--t-3)" }}>·</span>
                <span style={{ color: "var(--t-3)" }}>{r.action.chain.slice(0, 4)}</span>
                <span style={{ color: c, marginLeft: "auto" }}>{r.result.finalStatus}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Sparkline ───────────────────────────────────────────────────────────────
function Sparkline({ series }) {
  // series = [{ t, arrived, executed, rejected }, ...] last 60s
  const W = 320; const H = 60;
  if (!series.length) return null;
  const maxY = Math.max(8, ...series.map(s => Math.max(s.arrived, s.executed, s.rejected)));
  const xFor = i => (i / (series.length - 1 || 1)) * W;
  const yFor = v => H - (v / maxY) * (H - 4) - 2;

  function path(key) {
    return series.map((s, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)} ${yFor(s[key]).toFixed(1)}`).join(" ");
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 60, display: "block" }}>
      <path d={path("arrived")} stroke="var(--t-2)" strokeWidth="1" fill="none" />
      <path d={path("executed")} stroke="var(--ok)" strokeWidth="1" fill="none" />
      <path d={path("rejected")} stroke="var(--bad)" strokeWidth="1" fill="none" />
    </svg>
  );
}

// ─── Vitals ──────────────────────────────────────────────────────────────────
function Vitals({ vitals, series }) {
  return (
    <div className="panel" style={{ padding: 0 }}>
      <div className="panel-head">
        <span>vitals · 60s</span>
        <span className="live-pip">live</span>
      </div>
      <div style={{ padding: "12px 14px 14px" }}>
        <Sparkline series={series} />
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px 18px",
          marginTop: 12,
        }}>
          <Stat label="throughput" value={`${vitals.throughput.toFixed(1)}/s`} />
          <Stat label="reject rate" value={`${(vitals.rejectRate * 100).toFixed(0)}%`}
            color={vitals.rejectRate > 0.4 ? "var(--bad)" : "var(--t-0)"} />
          <Stat label="p50 latency" value={`${vitals.p50}ms`} />
          <Stat label="weakest" value={vitals.weakest} small />
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-3)", letterSpacing: "0.06em" }}>
          <span><span style={{ color: "var(--t-2)" }}>━</span> arrived</span>
          <span><span style={{ color: "var(--ok)" }}>━</span> executed</span>
          <span><span style={{ color: "var(--bad)" }}>━</span> rejected</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, small }) {
  return (
    <div>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: small ? 12 : 18, fontWeight: 500,
        color: color || "var(--t-0)",
        letterSpacing: small ? "0" : "-0.01em",
      }}>{value}</div>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 9,
        color: "var(--t-3)", letterSpacing: "0.14em",
        textTransform: "uppercase", marginTop: 4,
      }}>{label}</div>
    </div>
  );
}

window.Heatmap = Heatmap;
window.ChainPulse = ChainPulse;
window.AuditStream = AuditStream;
window.Vitals = Vitals;
