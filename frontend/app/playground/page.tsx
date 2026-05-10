"use client";

import { useState } from "react";
import { Nav } from "@/components/homepage/nav";

type ChainId = "ethereum" | "arbitrum" | "optimism" | "base" | "solana" | "cosmoshub" | "osmosis";
type Token = "ETH" | "USDC" | "USDT" | "SOL" | "ATOM" | "OSMO";
type ActionKind = "transfer" | "swap" | "contract_call";
type ResultStatus = "policy_rejected" | "simulation_failed" | "success" | "approval_required";

interface PolicyConfig {
  chain: ChainId;
  maxSpendAmount: number;
  maxSpendToken: Token;
  requireSimulation: boolean;
  gasBufferMultiplier: number;
  approvalThreshold: number;
  approvalTimeoutMs: number;
}

interface ActionConfig {
  kind: ActionKind;
  toAddress: string;
  token: Token;
  amount: number;
  maxSlippage: number;
}

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

interface SimResult {
  status: ResultStatus;
  checks: CheckResult[];
  simulation?: { gas: number; coverage: string; wouldRevert: boolean; revertReason?: string };
  receipt?: { txHash: string; blockNumber: number };
}

const KNOWN_CONTRACTS: Partial<Record<ChainId, string[]>> = {
  ethereum: ["0xE592427A0AEce92De3Edee1F18E0157C05861564", "0x111111125421ca6dc452d289314280a0f8842a65"],
  arbitrum: ["0xE592427A0AEce92De3Edee1F18E0157C05861564"],
};

const TOKEN_PRICES_USD: Record<Token, number> = {
  ETH: 3200, USDC: 1, USDT: 1, SOL: 185, ATOM: 8, OSMO: 0.65,
};

function toUSD(amount: number, token: Token) {
  return amount * TOKEN_PRICES_USD[token];
}

function mockSimulate(policy: PolicyConfig, action: ActionConfig): SimResult {
  const checks: CheckResult[] = [];

  checks.push({ name: "Chain allowed", passed: true, detail: `${policy.chain} is in policy` });

  if (action.kind === "swap" || action.kind === "contract_call") {
    const allowed = KNOWN_CONTRACTS[policy.chain] ?? [];
    const isKnown = allowed.some(addr => addr.toLowerCase() === action.toAddress.toLowerCase());
    checks.push({
      name: "Contract allowlist",
      passed: isKnown,
      detail: isKnown ? `${action.toAddress.slice(0, 10)}... is on the allowlist` : `${action.toAddress.slice(0, 10)}... is not on the allowlist`,
    });
    if (!isKnown) return { status: "policy_rejected", checks, simulation: { gas: 0, coverage: "none", wouldRevert: false } };
  } else {
    checks.push({ name: "Contract allowlist", passed: true, detail: "Transfer — no contract required" });
  }

  const spendUSD = toUSD(action.amount, action.token);
  const capUSD = toUSD(policy.maxSpendAmount, policy.maxSpendToken);
  const spendOk = spendUSD <= capUSD;
  checks.push({
    name: "Spend cap",
    passed: spendOk,
    detail: spendOk ? `$${spendUSD.toFixed(2)} ≤ $${capUSD.toFixed(2)} cap` : `$${spendUSD.toFixed(2)} exceeds $${capUSD.toFixed(2)} cap`,
  });
  if (!spendOk) return { status: "policy_rejected", checks, simulation: { gas: 0, coverage: "none", wouldRevert: false } };

  if (action.kind === "swap") {
    const slippageOk = action.maxSlippage > 0;
    checks.push({
      name: "Slippage declared",
      passed: slippageOk,
      detail: slippageOk ? `${action.maxSlippage} bps max slippage` : "maxSlippage must be > 0",
    });
    if (!slippageOk) return { status: "policy_rejected", checks, simulation: { gas: 0, coverage: "none", wouldRevert: false } };
  } else {
    checks.push({ name: "Slippage declared", passed: true, detail: "N/A for transfers" });
  }

  const mockGas = 21000 + Math.floor(Math.random() * 50000);
  const bufferedGas = Math.floor(mockGas * policy.gasBufferMultiplier);
  checks.push({ name: "Simulation passed", passed: true, detail: `Gas: ${bufferedGas.toLocaleString()} (${policy.gasBufferMultiplier}× buffer)` });

  const simulation = { gas: bufferedGas, coverage: "basic", wouldRevert: false };

  const spendUSD2 = toUSD(action.amount, action.token);
  if (spendUSD2 >= policy.approvalThreshold) {
    checks.push({ name: "Human approval", passed: false, detail: `$${spendUSD2.toFixed(2)} ≥ $${policy.approvalThreshold} threshold` });
    return { status: "approval_required", checks, simulation };
  }
  checks.push({ name: "Human approval", passed: true, detail: `$${spendUSD2.toFixed(2)} below $${policy.approvalThreshold} threshold` });

  return {
    status: "success",
    checks,
    simulation,
    receipt: {
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
      blockNumber: 21_000_000 + Math.floor(Math.random() * 100_000),
    },
  };
}

const STATUS_CONFIG: Record<ResultStatus, { label: string; color: string; icon: string }> = {
  success:           { label: "Success",           color: "text-success", icon: "✓" },
  policy_rejected:   { label: "Policy Rejected",   color: "text-danger",  icon: "✗" },
  simulation_failed: { label: "Simulation Failed", color: "text-warning", icon: "!" },
  approval_required: { label: "Approval Required", color: "text-warning", icon: "~" },
};

const SECTION_HEAD: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--color-text-tertiary)",
  marginBottom: "1.25rem",
};

const DATA_ROW: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  padding: "0.25rem 0",
};

function statusColor(status: ResultStatus): string {
  if (status === "success") return "var(--color-success)";
  if (status === "policy_rejected") return "var(--color-danger)";
  return "var(--color-amber)";
}


export default function PlaygroundPage() {
  const [policy, setPolicy] = useState<PolicyConfig>({
    chain: "ethereum",
    maxSpendAmount: 1000,
    maxSpendToken: "USDC",
    requireSimulation: true,
    gasBufferMultiplier: 1.2,
    approvalThreshold: 10000,
    approvalTimeoutMs: 30000,
  });

  const [action, setAction] = useState<ActionConfig>({
    kind: "transfer",
    toAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    token: "ETH",
    amount: 0.1,
    maxSlippage: 50,
  });

  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<Array<{ prefix: string; text: string; status: "pass" | "fail" | "warn" | "dim" }>>([]);
  const [done, setDone] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [simResult, setSimResult] = useState<SimResult | null>(null);

  function handleRun() {
    setLines([]);
    setDone(false);
    setCursorVisible(true);
    setSimResult(null);
    setRunning(true);

    const sim = mockSimulate(policy, action);
    setSimResult(sim);

    const sequence: Array<{ prefix: string; text: string; status: "pass" | "fail" | "warn" | "dim" }> = [];

    sequence.push({ prefix: "$", text: `txfence submit --kind ${action.kind} --chain ${policy.chain}`, status: "dim" });
    sequence.push({ prefix: "", text: "", status: "dim" });

    for (const check of sim.checks) {
      const prefix =
        check.name.toLowerCase().includes("simulation") ? "simulate" :
        check.name.toLowerCase().includes("approval")   ? "approve " :
        "policy  ";
      if (check.passed) {
        sequence.push({ prefix, text: `✓ ${check.name.toLowerCase()} — ${check.detail}`, status: "pass" });
      } else {
        sequence.push({ prefix, text: `✗ ${check.name.toLowerCase()} — ${check.detail}`, status: "fail" });
        break;
      }
    }

    if (sim.status === "success" && sim.receipt) {
      sequence.push({ prefix: "execute ", text: `✓ ${sim.receipt.txHash.slice(0, 18)}...`, status: "pass" });
    }
    if (sim.status === "approval_required") {
      sequence.push({ prefix: "approve ", text: "— above threshold · webhook dispatched · cancel on timeout", status: "warn" });
    }
    if (sim.status === "simulation_failed") {
      sequence.push({ prefix: "simulate", text: "✗ simulation failed · would revert", status: "fail" });
    }

    sequence.forEach((line, i) => {
      setTimeout(() => {
        setLines(prev => [...prev, line]);
        if (i === sequence.length - 1) {
          setRunning(false);
          setDone(true);
          setTimeout(() => setCursorVisible(false), 800);
        }
      }, 200 + i * 90);
    });
  }

  const PANEL: React.CSSProperties = {
    border: "1px solid var(--color-border-primary)",
    borderRadius: 8,
    padding: "1.5rem",
    background: "var(--color-bg-card)",
  };

  return (
    <>
      <Nav />
      <main style={{ minHeight: "100vh", padding: "7rem 1.5rem 4rem", background: "var(--color-bg-primary)" }}>
        <style>{`
          .pg-label { display: block; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-tertiary); margin-bottom: 0.375rem; }
          .pg-input { width: 100%; background: var(--color-bg-primary); border: 1px solid var(--color-border-primary); border-radius: 5px; padding: 0.4rem 0.625rem; font-family: var(--font-mono); font-size: 12px; color: var(--color-text-primary); outline: none; box-sizing: border-box; }
          .pg-input:focus { border-color: var(--color-border-secondary); }
          .pg-select { appearance: none; cursor: pointer; }
          .pg-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
          .pg-fields > * + * { margin-top: 1rem; }
          .pg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
          @media (max-width: 768px) { .pg-grid { grid-template-columns: 1fr; } }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        `}</style>

        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ marginBottom: "2.5rem" }}>
            <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "1.5rem", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "0.375rem" }}>
              Playground
            </h1>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-tertiary)" }}>
              Configure a policy and action, then run the pipeline to see the result.
            </p>
          </div>

          <div className="pg-grid">
            {/* Left Panel */}
            <div style={PANEL}>
              <p style={SECTION_HEAD}>Policy</p>
              <div className="pg-fields">
                <Field label="Allowed Chain">
                  <select className="pg-input pg-select" value={policy.chain} onChange={e => setPolicy({ ...policy, chain: e.target.value as ChainId })}>
                    {(["ethereum","arbitrum","optimism","base","solana","cosmoshub","osmosis"] as ChainId[]).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <div className="pg-grid-2">
                  <Field label="Max Spend Per Tx">
                    <input type="number" className="pg-input" value={policy.maxSpendAmount} min={0} onChange={e => setPolicy({ ...policy, maxSpendAmount: +e.target.value })} />
                  </Field>
                  <Field label="Token">
                    <select className="pg-input pg-select" value={policy.maxSpendToken} onChange={e => setPolicy({ ...policy, maxSpendToken: e.target.value as Token })}>
                      {(["ETH","USDC","USDT","SOL","ATOM","OSMO"] as Token[]).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Gas Buffer Multiplier">
                  <input type="number" className="pg-input" value={policy.gasBufferMultiplier} min={1} step={0.1} onChange={e => setPolicy({ ...policy, gasBufferMultiplier: +e.target.value })} />
                </Field>
                <div className="pg-grid-2">
                  <Field label="Approval Threshold ($)">
                    <input type="number" className="pg-input" value={policy.approvalThreshold} min={0} onChange={e => setPolicy({ ...policy, approvalThreshold: +e.target.value })} />
                  </Field>
                  <Field label="Approval Timeout (ms)">
                    <input type="number" className="pg-input" value={policy.approvalTimeoutMs} min={1000} step={1000} onChange={e => setPolicy({ ...policy, approvalTimeoutMs: +e.target.value })} />
                  </Field>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={policy.requireSimulation} onChange={e => setPolicy({ ...policy, requireSimulation: e.target.checked })} style={{ width: 14, height: 14, accentColor: "var(--color-text-secondary)", cursor: "pointer" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-secondary)" }}>Require simulation</span>
                </label>
              </div>

              <p style={{ ...SECTION_HEAD, paddingTop: "1.25rem", borderTop: "1px solid var(--color-border-primary)", marginTop: "1.5rem" }}>Action</p>
              <div className="pg-fields">
                <Field label="Kind">
                  <select className="pg-input pg-select" value={action.kind} onChange={e => setAction({ ...action, kind: e.target.value as ActionKind })}>
                    <option value="transfer">transfer</option>
                    <option value="swap">swap</option>
                    <option value="contract_call">contract_call</option>
                  </select>
                </Field>
                <Field label={action.kind === "transfer" ? "To Address" : "Contract Address"}>
                  <input type="text" className="pg-input" value={action.toAddress} onChange={e => setAction({ ...action, toAddress: e.target.value })} placeholder="0x..." />
                </Field>
                <div className="pg-grid-2">
                  <Field label="Token">
                    <select className="pg-input pg-select" value={action.token} onChange={e => setAction({ ...action, token: e.target.value as Token })}>
                      {(["ETH","USDC","USDT","SOL","ATOM","OSMO"] as Token[]).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Amount">
                    <input type="number" className="pg-input" value={action.amount} min={0} step={0.01} onChange={e => setAction({ ...action, amount: +e.target.value })} />
                  </Field>
                </div>
                {action.kind === "swap" && (
                  <Field label="Max Slippage (bps)">
                    <input type="number" className="pg-input" value={action.maxSlippage} min={0} onChange={e => setAction({ ...action, maxSlippage: +e.target.value })} placeholder="50 = 0.5%" />
                  </Field>
                )}
              </div>

              <button
                onClick={handleRun}
                disabled={running}
                style={{ width: "100%", marginTop: "1.5rem", padding: "0.625rem 1rem", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-bg-primary)", background: "var(--color-text-primary)", border: "none", borderRadius: 6, cursor: running ? "not-allowed" : "pointer", transition: "opacity 0.15s ease", opacity: running ? 0.5 : 1 }}
              >
                {running ? "Running pipeline..." : "Run Pipeline"}
              </button>
            </div>

            {/* Right Panel */}
            <div style={{ ...PANEL, minHeight: 400, display: "flex", flexDirection: "column" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.9, height: "100%", minHeight: 360, display: "flex", flexDirection: "column", justifyContent: lines.length === 0 && !running ? "center" : "flex-start" }}>

                {lines.length === 0 && !running && (
                  <div style={{ textAlign: "center", color: "var(--color-text-tertiary)" }}>
                    <svg width="24" height="16" viewBox="0 0 28 18" fill="none" aria-hidden="true" style={{ color: "var(--color-text-tertiary)", display: "block", margin: "0 auto 0.75rem" }}>
                      <rect x="5" y="1" width="2" height="16" rx="1" fill="currentColor"/>
                      <rect x="1" y="1" width="10" height="2" rx="1" fill="currentColor"/>
                      <rect x="18" y="1" width="2" height="16" rx="1" fill="currentColor"/>
                      <rect x="18" y="1" width="8" height="2" rx="1" fill="currentColor"/>
                      <rect x="14" y="9" width="12" height="2" rx="1" fill="currentColor"/>
                    </svg>
                    <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", maxWidth: 200, margin: "0 auto", lineHeight: 1.6 }}>
                      configure a policy and action, then click{" "}
                      <span style={{ color: "var(--color-text-secondary)" }}>run pipeline</span>
                    </p>
                  </div>
                )}

                {lines.length > 0 && (
                  <div>
                    {lines.map((line, i) => {
                      if (line.prefix === "" && line.text === "") return <div key={i} style={{ height: "0.5rem" }} />;
                      const textColor =
                        line.status === "pass" ? "var(--color-text-secondary)" :
                        line.status === "fail" ? "var(--color-danger)" :
                        line.status === "warn" ? "var(--color-amber)" :
                        "var(--color-text-tertiary)";
                      const hasSymbol = line.text.startsWith("✓") || line.text.startsWith("✗") || line.text.startsWith("—");
                      const symbol = hasSymbol ? line.text[0] : null;
                      const symbolColor = line.status === "pass" ? "var(--color-success)" : line.status === "fail" ? "var(--color-danger)" : line.status === "warn" ? "var(--color-amber)" : "transparent";
                      const rest = hasSymbol ? line.text.slice(2) : line.text;
                      return (
                        <div key={i} style={{ display: "flex", gap: "0.75rem", animation: "fade-in 0.2s ease both" }}>
                          <span style={{ color: "var(--color-text-tertiary)", flexShrink: 0, minWidth: "4.5rem", userSelect: "none" }}>{line.prefix === "$" ? "$" : line.prefix}</span>
                          {symbol && <span style={{ color: symbolColor, flexShrink: 0, width: "0.75rem" }}>{symbol}</span>}
                          <span style={{ color: textColor }}>{rest || line.text}</span>
                        </div>
                      );
                    })}

                    {cursorVisible && (
                      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.1rem" }}>
                        <span style={{ color: "transparent", minWidth: "4.5rem" }}>·</span>
                        <span style={{ display: "inline-block", width: 2, height: "0.85em", background: "var(--color-text-secondary)", verticalAlign: "text-bottom", animation: "cursor-blink 0.7s ease infinite" }} />
                      </div>
                    )}

                    {done && (
                      <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--color-border-primary)", animation: "fade-in 0.3s ease both" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: simResult?.status === "success" ? "var(--color-success)" : simResult?.status === "policy_rejected" ? "var(--color-danger)" : "var(--color-amber)" }}>
                          {simResult?.status === "success" ? "✓ success" : simResult?.status === "policy_rejected" ? "✗ policy rejected" : "— approval required"}
                        </span>
                        <span style={{ color: "var(--color-text-tertiary)", fontSize: 11, marginLeft: "0.5rem" }}>· pipeline complete</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="pg-label">{label}</label>
      {children}
    </div>
  );
}
