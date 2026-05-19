// The Stream — fence in ambient mode. Always-running particle field.
const { useEffect, useRef, useState, useCallback } = React;

const GATE_X = [0.18, 0.40, 0.62, 0.84];

function Stream({ policy, mode, paused, fireSpike, onSettled, counters, lastVerdict }) {
  const railRef = useRef(null);
  const layerRef = useRef(null);
  const rafRef = useRef(0);
  const particles = useRef([]);
  const gateAnimRef = useRef([0,0,0,0]);
  const idRef = useRef(0);
  const lastAmbientRef = useRef(0);
  const ingestedRef = useRef(0);

  // Ambient generator + ingest custom spikes
  useEffect(() => {
    if (fireSpike.queue.length > ingestedRef.current) {
      const slice = fireSpike.queue.slice(ingestedRef.current);
      ingestedRef.current = fireSpike.queue.length;
      const now = performance.now();
      for (const item of slice) spawn(item.action, item.result, now, true);
    }
  }, [fireSpike]);

  function spawn(action, result, now, spike) {
    idRef.current += 1;
    particles.current.push({
      id: idRef.current,
      action, result,
      t0: now,
      x: 0,
      lane: spike ? 0 : (Math.random() - 0.5) * 0.85,
      thread: action.threadId || 1,
      spike: !!spike,
      status: "flying",
      finalGate: result.finalGate,
      finalStatus: result.finalStatus,
    });
  }

  useEffect(() => {
    let mounted = true;
    const SPEED = 0.50;
    const REJECT_LINGER = 1100;
    const APPROVAL_LINGER = 1700;

    const tick = () => {
      if (!mounted) return;
      const layer = layerRef.current; const rail = railRef.current;
      if (!layer || !rail) { rafRef.current = requestAnimationFrame(tick); return; }
      const rect = rail.getBoundingClientRect();
      const W = rect.width; const H = rect.height;
      const now = performance.now();
      const gateXs = GATE_X.map(g => g * W);

      // ambient spawn
      if (!paused) {
        const interval = mode === "adversary" ? 300 : 700;
        if (now - lastAmbientRef.current > interval + Math.random()*220) {
          lastAmbientRef.current = now;
          const a = window.makeAmbientAction(policy.chain, mode);
          const r = window.evaluate(policy, a);
          spawn(a, r, now, false);
        }
      }

      // step
      const settled = [];
      for (const p of particles.current) {
        if (paused) continue;
        const elapsed = now - p.t0;
        if (p.status === "flying") {
          const traveled = elapsed * SPEED;
          if (p.finalStatus === "executed") {
            p.x = Math.min(W + 30, traveled);
            for (let gi = 0; gi < gateXs.length; gi++) {
              if (p.x >= gateXs[gi] && !p[`f_${gi}`]) { p[`f_${gi}`] = true; gateAnimRef.current[gi] = now; }
            }
            if (p.x >= W + 28) { p.status = "done"; settled.push(p); }
          } else {
            const finalX = gateXs[p.finalGate];
            if (traveled < finalX) {
              p.x = traveled;
              for (let gi = 0; gi < p.finalGate; gi++) {
                if (p.x >= gateXs[gi] && !p[`f_${gi}`]) { p[`f_${gi}`] = true; gateAnimRef.current[gi] = now; }
              }
            } else {
              p.x = finalX;
              p.status = "judged"; p.judgedAt = now;
              gateAnimRef.current[p.finalGate] = now;
            }
          }
        } else if (p.status === "judged") {
          const linger = p.finalStatus === "approval" ? APPROVAL_LINGER : REJECT_LINGER;
          if (now - p.judgedAt > linger) { p.status = "done"; settled.push(p); }
        }
      }

      if (settled.length) {
        onSettled(settled.map(p => ({ id: p.id, action: p.action, result: p.result, spike: p.spike })));
        particles.current = particles.current.filter(p => p.status !== "done");
      }

      // render particles
      const existing = new Map();
      for (const c of layer.children) existing.set(+c.dataset.pid, c);
      const seen = new Set();
      for (const p of particles.current) {
        seen.add(p.id);
        let el = existing.get(p.id);
        if (!el) {
          el = document.createElement("div");
          el.dataset.pid = p.id;
          el.className = "particle" + (p.spike ? " spike" : "");
          el.innerHTML = `<span class="dot"></span><span class="trail"></span>`;
          layer.appendChild(el);
        }
        const cy = H/2 + p.lane * (H * 0.42);
        const colorVar = p.finalStatus === "executed" ? "var(--ok)"
          : p.finalStatus === "approval" ? "var(--warn)" : "var(--bad)";
        const isPastFinalGate = p.x >= gateXs[p.finalGate] - 1;
        const flying = p.status === "flying";
        const threadColor = p.thread === 1 ? "var(--thread-1)" : p.thread === 2 ? "var(--thread-2)" : "var(--thread-3)";
        const liveColor = p.spike ? "var(--t-0)" : (flying && !isPastFinalGate ? threadColor : colorVar);
        el.style.transform = `translate(${p.x}px, ${cy}px)`;
        el.style.setProperty("--c", liveColor);
        el.style.opacity = p.spike && p.status === "flying" ? "1" : (p.status === "judged" ? "0.95" : "0.85");
      }
      for (const [pid, el] of existing) if (!seen.has(pid)) el.remove();

      // gate glow
      const gateEls = rail.querySelectorAll(".gate");
      gateEls.forEach((g, i) => {
        const dt = now - gateAnimRef.current[i];
        g.style.setProperty("--gate-glow", dt < 600 ? String(1 - dt/600) : "0");
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { mounted = false; cancelAnimationFrame(rafRef.current); };
  }, [policy, mode, paused, onSettled]);

  return (
    <div className="stream-wrap panel">
      <style>{`
        .stream-wrap { padding: 0; }
        .stream-head {
          padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;
          border-bottom: 1px solid var(--line-0);
        }
        .stream-head .lhs { display: flex; align-items: center; gap: 14px; }
        .stream-head .kicker {
          font-family: var(--font-mono); font-size: 10px;
          letter-spacing: 0.18em; text-transform: uppercase; color: var(--t-1);
        }
        .stream-head .sub {
          font-family: var(--font-mono); font-size: 10px; color: var(--t-3);
          letter-spacing: 0.06em;
        }
        .stream-head .live {
          font-family: var(--font-mono); font-size: 10px; color: var(--t-2);
          display: inline-flex; align-items: center; gap: 6px;
          padding: 3px 8px; border: 1px solid var(--line-0); border-radius: 3px;
        }
        .stream-head .live::before {
          content: ""; width: 6px; height: 6px; border-radius: 50%;
          background: var(--ok);
          animation: pip-blink 2s ease-in-out infinite;
        }
        .stream-head .live.paused::before {
          background: var(--warn); animation: none;
        }

        .stream-rail {
          position: relative; width: 100%; height: 240px;
          overflow: hidden;
          background:
            radial-gradient(800px 240px at 50% 50%, rgba(255,255,255,0.025), transparent 60%);
        }
        .stream-rail::before {
          content: "";
          position: absolute; left: 0; right: 0; top: 50%; height: 1px;
          background: linear-gradient(90deg, transparent, var(--line-0) 6%, var(--line-1) 50%, var(--line-0) 94%, transparent);
        }
        .stream-rail::after {
          content: "";
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px);
          background-size: 100% 32px;
          pointer-events: none;
          mask: linear-gradient(180deg, transparent, black 30%, black 70%, transparent);
        }

        .endpoint {
          position: absolute; top: 50%; transform: translateY(-50%);
          font-family: var(--font-mono); font-size: 10px;
          letter-spacing: 0.14em; text-transform: uppercase; color: var(--t-3);
          display: flex; align-items: center; gap: 8px;
          z-index: 2;
        }
        .endpoint.left { left: 14px; }
        .endpoint.right { right: 14px; flex-direction: row-reverse; }
        .endpoint .glyph {
          width: 10px; height: 10px;
          border: 1px solid var(--t-3); background: var(--bg-0);
          border-radius: 1px; position: relative;
        }
        .endpoint .glyph::after {
          content: ""; position: absolute; inset: 2px;
          background: var(--t-3); border-radius: 1px;
          animation: dot-soft 3s ease-in-out infinite;
        }

        .gate {
          position: absolute; top: 12%; bottom: 12%; width: 1px;
          background: linear-gradient(180deg, transparent, var(--line-1) 12%, var(--line-2) 50%, var(--line-1) 88%, transparent);
          z-index: 1;
        }
        .gate-cap {
          position: absolute; left: -3px; width: 7px; height: 7px;
          border: 1px solid var(--line-2); background: var(--bg-card);
          border-radius: 1px;
        }
        .gate-cap.top { top: -3px; }
        .gate-cap.bot { bottom: -3px; }
        .gate-glow {
          position: absolute; left: 50%; top: 50%;
          width: 36px; height: 36px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: radial-gradient(circle, currentColor 0%, transparent 65%);
          opacity: calc(var(--gate-glow, 0) * 0.55);
          color: var(--t-1);
          pointer-events: none;
        }
        .gate-label {
          position: absolute; left: 50%; transform: translateX(-50%);
          top: -16px;
          font-family: var(--font-mono); font-size: 10px;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--t-2); white-space: nowrap;
        }
        .gate-counts {
          position: absolute; left: 50%; transform: translateX(-50%);
          bottom: -28px;
          font-family: var(--font-mono); font-size: 10px;
          color: var(--t-3); white-space: nowrap; text-align: center;
        }
        .gate-counts .pass { color: var(--t-1); }
        .gate-counts .stop { color: var(--bad); }
        .gate-counts .wait { color: var(--warn); }

        .particle { position: absolute; left: 0; top: 0; will-change: transform; pointer-events: none; color: var(--c); }
        .particle .dot {
          position: absolute; left: -3px; top: -3px;
          width: 6px; height: 6px;
          background: currentColor;
          border-radius: 50%;
          box-shadow: 0 0 8px currentColor;
        }
        .particle .trail {
          position: absolute; left: -32px; top: -1px;
          width: 32px; height: 2px;
          background: linear-gradient(90deg, transparent, currentColor);
          opacity: 0.45;
          border-radius: 2px;
        }
        .particle.spike .dot {
          width: 8px; height: 8px;
          left: -4px; top: -4px;
          box-shadow: 0 0 14px currentColor, 0 0 30px currentColor;
        }
        .particle.spike .trail {
          left: -56px; width: 56px;
          opacity: 0.85;
        }
      `}</style>

      <div className="stream-head">
        <div className="lhs">
          <span className="kicker">stream</span>
          <span className="sub">
            {mode === "adversary" ? "adversary · biased traffic" : "ambient · 1 agent thread × 3"}
          </span>
        </div>
        <div className="lhs">
          {lastVerdict && (
            <span className="sub" style={{ color: "var(--t-2)" }}>
              {lastVerdict.action.kind} · {lastVerdict.action.amount} {lastVerdict.action.token} →
              <span style={{
                color: lastVerdict.result.finalStatus === "executed" ? "var(--ok)"
                  : lastVerdict.result.finalStatus === "approval" ? "var(--warn)" : "var(--bad)",
                marginLeft: 6,
              }}>{lastVerdict.result.finalStatus}</span>
            </span>
          )}
          <span className={"live" + (paused ? " paused" : "")}>{paused ? "paused" : "live"}</span>
        </div>
      </div>

      <div className="stream-rail" ref={railRef}>
        <div className="endpoint left">
          <span className="glyph"></span>
          <span>agent</span>
        </div>
        <div className="endpoint right">
          <span className="glyph"></span>
          <span>chain</span>
        </div>
        {window.GATES.map((g, i) => (
          <div key={g} className="gate" style={{ left: `${GATE_X[i]*100}%` }}>
            <span className="gate-cap top"></span>
            <span className="gate-cap bot"></span>
            <span className="gate-glow"></span>
            <span className="gate-label">{g}</span>
            <span className="gate-counts">
              <span className="pass">{counters[g].pass}</span>
              <span style={{ color: "var(--t-3)" }}> · </span>
              <span className={g === "approve" ? "wait" : "stop"}>{counters[g].stop}</span>
            </span>
          </div>
        ))}
        <div ref={layerRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      </div>
    </div>
  );
}

window.Stream = Stream;
