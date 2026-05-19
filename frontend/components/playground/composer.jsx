// v2 Composer — tighter, real-time, no fire button (auto-injects when params committed).
const { useState } = React;

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="lbl">{label}</label>
      {children}
      {hint && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-3)", marginTop: 4, letterSpacing: "0.04em" }}>{hint}</div>}
    </div>
  );
}

function Slider({ value, min, max, step, onChange, format }) {
  return (
    <div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{
          width: "100%", accentColor: "var(--t-0)",
          background: "transparent",
        }}
      />
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--t-1)", marginTop: 2 }}>
        {format ? format(value) : value}
      </div>
    </div>
  );
}

function PolicyPanel({ policy, setPolicy }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span>policy · live</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-3)" }}>tune to reshape</span>
      </div>
      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Allowed chain">
          <select className="ipt sel" value={policy.chain}
            onChange={e => setPolicy({ ...policy, chain: e.target.value })}>
            {window.CHAINS_ALL.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label={`Spend cap · ${policy.maxSpendAmount} ${policy.maxSpendToken}`}>
          <Slider min={50} max={50000} step={50}
            value={policy.maxSpendAmount}
            onChange={v => setPolicy({ ...policy, maxSpendAmount: v })}
            format={v => `$${v.toLocaleString()}`} />
        </Field>
        <Field label={`Approval threshold`}>
          <Slider min={500} max={50000} step={500}
            value={policy.approvalThreshold}
            onChange={v => setPolicy({ ...policy, approvalThreshold: v })}
            format={v => `≥ $${v.toLocaleString()}`} />
        </Field>
        <Field label={`Gas buffer`}>
          <Slider min={1.0} max={2.0} step={0.05}
            value={policy.gasBufferMultiplier}
            onChange={v => setPolicy({ ...policy, gasBufferMultiplier: +v.toFixed(2) })}
            format={v => `${v.toFixed(2)}× est.`} />
        </Field>
      </div>
    </div>
  );
}

function ActionPanel({ action, setAction, onSpike, mode, setMode, paused, setPaused, onReset }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span>spike · inject</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-3)" }}>test against live stream</span>
      </div>
      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Kind">
          <div className="seg" style={{ display: "flex", width: "fit-content" }}>
            {window.KINDS_ALL.map(k => (
              <button key={k} type="button" className={action.kind === k ? "on" : ""}
                onClick={() => setAction({ ...action, kind: k })}>{k}</button>
            ))}
          </div>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Amount">
            <input type="number" className="ipt" value={action.amount} min={0} step={0.01}
              onChange={e => setAction({ ...action, amount: +e.target.value })} />
          </Field>
          <Field label="Token">
            <select className="ipt sel" value={action.token}
              onChange={e => setAction({ ...action, token: e.target.value })}>
              {window.TOKENS_ALL.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Chain">
          <select className="ipt sel" value={action.chain}
            onChange={e => setAction({ ...action, chain: e.target.value })}>
            {window.CHAINS_ALL.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label={action.kind === "transfer" ? "to address" : "contract"}>
          <input type="text" className="ipt" value={action.toAddress}
            onChange={e => setAction({ ...action, toAddress: e.target.value })} />
        </Field>
        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 4 }}>
          <button className="btn" onClick={onSpike}>inject spike →</button>
          <button className="btn ghost" onClick={() => setPaused(!paused)}>{paused ? "resume" : "pause"}</button>
          <button className="btn ghost" onClick={onReset} style={{ marginLeft: "auto" }}>reset</button>
        </div>
        <div style={{
          marginTop: 4, paddingTop: 12,
          borderTop: "1px dashed var(--line-0)",
          display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between",
        }}>
          <div>
            <div className="lbl">stream mode</div>
            <div className="seg" style={{ display: "flex" }}>
              <button type="button" className={mode === "ambient" ? "on" : ""} onClick={() => setMode("ambient")}>ambient</button>
              <button type="button" className={mode === "adversary" ? "on" : ""} onClick={() => setMode("adversary")}>adversary</button>
            </div>
          </div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--t-3)",
            maxWidth: 140, lineHeight: 1.55, textAlign: "right",
          }}>
            {mode === "adversary" ? "biased · tries edge cases · 3× rate" : "natural traffic · 3 threads"}
          </div>
        </div>
      </div>
    </div>
  );
}

window.PolicyPanel = PolicyPanel;
window.ActionPanel = ActionPanel;
