// txfence playground — main app
const { useState, useEffect, useMemo, useRef, useCallback } = React;

function nowStamp() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, "0")).join(":") +
    "." + String(d.getMilliseconds()).padStart(3, "0").slice(0,3);
}

function App() {
  const [policy, setPolicy] = useState(window.defaultPolicy());
  const [mode, setMode] = useState("ambient");
  const [paused, setPaused] = useState(false);
  const [action, setAction] = useState({
    kind: "swap", chain: "ethereum", token: "USDC", amount: 850,
    toAddress: "0xe592427a0aece92de3edee1f18e0157c05861564",
    maxSlippage: 50,
  });

  // counters per gate: pass / stop
  const [counters, setCounters] = useState(() => ({
    chain: { pass: 0, stop: 0 }, amount: { pass: 0, stop: 0 },
    target: { pass: 0, stop: 0 }, approve: { pass: 0, stop: 0 },
  }));

  const [auditRows, setAuditRows] = useState([]);  // recent settled
  const [chainPulses, setChainPulses] = useState({});
  const [pulseKB, setPulseKB] = useState(null); // {kind, bucket} for heatmap pulse
  const [lastVerdict, setLastVerdict] = useState(null);

  // historical series for sparkline (per second buckets)
  const [series, setSeries] = useState(() => Array.from({length: 60}, () => ({ arrived: 0, executed: 0, rejected: 0 })));
  const tickBucketRef = useRef({ arrived: 0, executed: 0, rejected: 0 });

  // spike queue passed to Stream
  const [fireSpike, setFireSpike] = useState({ queue: [] });

  useEffect(() => {
    const id = setInterval(() => {
      setSeries(s => {
        const next = s.slice(1);
        next.push(tickBucketRef.current);
        tickBucketRef.current = { arrived: 0, executed: 0, rejected: 0 };
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleSettled = useCallback((settled) => {
    if (!settled.length) return;
    setCounters(c => {
      const next = { chain: {...c.chain}, amount: {...c.amount}, target: {...c.target}, approve: {...c.approve} };
      for (const p of settled) {
        const fr = p.result;
        const gateName = window.GATES[fr.finalGate];
        if (fr.finalStatus === "executed") {
          for (const g of window.GATES) next[g].pass++;
        } else if (fr.finalStatus === "approval") {
          for (let i = 0; i < 3; i++) next[window.GATES[i]].pass++;
          next.approve.stop++;
        } else {
          // rejected at finalGate
          for (let i = 0; i < fr.finalGate; i++) next[window.GATES[i]].pass++;
          next[gateName].stop++;
        }
      }
      return next;
    });

    // chain pulse for executed
    setChainPulses(prev => {
      const next = { ...prev };
      const t = performance.now();
      for (const p of settled) {
        if (p.result.finalStatus === "executed") next[p.action.chain] = t;
      }
      return next;
    });

    // heatmap pulse — pick most recent kind+bucket
    if (settled.length) {
      const last = settled[settled.length - 1];
      const usd = window.toUSD(last.action.amount, last.action.token);
      const buckets = [50, 250, 1000, 5000, 25000, Infinity];
      const bi = buckets.findIndex(b => usd < b);
      setPulseKB({ kind: last.action.kind, bucket: bi >= 0 ? bi : 5 });
      setTimeout(() => setPulseKB(p => (p && p.kind === last.action.kind && p.bucket === bi) ? null : p), 700);
      setLastVerdict({ action: last.action, result: last.result });
    }

    // tally for sparkline
    for (const p of settled) {
      tickBucketRef.current.arrived++;
      if (p.result.finalStatus === "executed") tickBucketRef.current.executed++;
      else if (p.result.finalStatus !== "approval") tickBucketRef.current.rejected++;
    }

    // audit rows
    setAuditRows(prev => {
      const fresh = settled.map(p => ({ id: p.id, t: nowStamp(), action: p.action, result: p.result, spike: p.spike }));
      return [...fresh.reverse(), ...prev].slice(0, 80);
    });
  }, []);

  function injectSpike() {
    const r = window.evaluate(policy, action);
    setFireSpike(prev => ({ queue: [...prev.queue, { action: { ...action, threadId: 1 }, result: r }] }));
  }

  function reset() {
    setCounters({ chain: { pass: 0, stop: 0 }, amount: { pass: 0, stop: 0 }, target: { pass: 0, stop: 0 }, approve: { pass: 0, stop: 0 }});
    setAuditRows([]);
    setChainPulses({});
    setSeries(Array.from({length: 60}, () => ({ arrived: 0, executed: 0, rejected: 0 })));
  }

  // vitals
  const vitals = useMemo(() => {
    const recent = series.slice(-10);
    const arrived = recent.reduce((a, s) => a + s.arrived, 0);
    const executed = recent.reduce((a, s) => a + s.executed, 0);
    const rejected = recent.reduce((a, s) => a + s.rejected, 0);
    const tp = arrived / 10;
    const rr = arrived ? rejected / arrived : 0;
    // weakest gate = highest stop count
    let weakest = "—"; let max = 0;
    for (const g of window.GATES) {
      if (counters[g].stop > max) { max = counters[g].stop; weakest = g; }
    }
    return { throughput: tp, rejectRate: rr, p50: 12 + Math.round(Math.random() * 4), weakest };
  }, [series, counters]);

  return (
    <div className="page">
      <Header />
      <Hero />
      <main className="grid">
        <section className="full">
          <window.Stream
            policy={policy}
            mode={mode}
            paused={paused}
            fireSpike={fireSpike}
            onSettled={handleSettled}
            counters={counters}
            lastVerdict={lastVerdict}
          />
        </section>

        <section className="col-policy">
          <window.PolicyPanel policy={policy} setPolicy={setPolicy} />
        </section>
        <section className="col-action">
          <window.ActionPanel
            action={action} setAction={setAction}
            onSpike={injectSpike}
            mode={mode} setMode={setMode}
            paused={paused} setPaused={setPaused}
            onReset={reset}
          />
        </section>
        <section className="col-vitals">
          <window.Vitals vitals={vitals} series={series} />
        </section>

        <section className="col-heat">
          <window.Heatmap policy={policy} pulse={pulseKB} />
        </section>
        <section className="col-chain">
          <window.ChainPulse policy={policy} pulses={chainPulses} />
        </section>
        <section className="col-audit">
          <window.AuditStream rows={auditRows} />
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="hdr">
      <div className="hdr-l">
        <span className="brand">txfence</span>
        <nav className="nav">
          <a>main</a>
          <a>docs</a>
          <a className="cur">playground</a>
          <a>changelog</a>
        </nav>
      </div>
      <div className="hdr-r">
        <span className="kbd">⌘K</span>
        <a className="ghost">github ↗</a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-meta">
        <span className="dot live" />
        <span>playground</span>
        <span className="sep">/</span>
        <span>policy in motion</span>
      </div>
      <h1>
        Watch your policy<br/>
        <em>think.</em>
      </h1>
      <p>
        A live agent stream runs through your fence in real time. Every transit hits four gates —
        <span className="kc">chain</span> · <span className="kc">amount</span> · <span className="kc">target</span> · <span className="kc">approve</span>.
        Tune the policy and the stream re-shapes underneath you. Inject a spike to test an edge.
      </p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="ftr">
      <span>txfence/playground · 0.6.2</span>
      <span>simulator only · no signers loaded</span>
    </footer>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
