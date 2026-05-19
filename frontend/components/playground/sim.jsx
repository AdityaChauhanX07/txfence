// v2 sim — same evaluator + ambient generator + adversary mode
const TOKEN_USD = { ETH: 3200, USDC: 1, USDT: 1, SOL: 185, ATOM: 8, OSMO: 0.65 };

const KNOWN_CONTRACTS = {
  ethereum: ["0xe592427a0aece92de3edee1f18e0157c05861564", "0x111111125421ca6dc452d289314280a0f8842a65"],
  arbitrum: ["0xe592427a0aece92de3edee1f18e0157c05861564"],
  optimism: ["0xe592427a0aece92de3edee1f18e0157c05861564"],
  base:     ["0xe592427a0aece92de3edee1f18e0157c05861564"],
  solana:   ["jup6lkbzbjs1jksn1fwzfuonn4dxchphwxdpzxn7m6m"],
  cosmoshub:[],
  osmosis:  [],
};

window.CHAINS_ALL = ["ethereum","arbitrum","optimism","base","solana","cosmoshub","osmosis"];
window.TOKENS_ALL = ["ETH","USDC","USDT","SOL","ATOM","OSMO"];
window.KINDS_ALL  = ["transfer","swap","contract_call"];

const toUSD = (a, t) => a * (TOKEN_USD[t] ?? 1);
window.toUSD = toUSD;

window.evaluate = function evaluate(policy, action) {
  const gates = [];
  const capUSD = toUSD(policy.maxSpendAmount, policy.maxSpendToken);
  const spendUSD = toUSD(action.amount, action.token);

  let pass = true, reason = "all checks passed";
  const checks = [];
  if (policy.chain !== action.chain) { pass = false; reason = `chain mismatch — ${action.chain} not allowed`; }
  checks.push({ ok: pass, k: "chain" });
  if (pass && (action.kind === "swap" || action.kind === "contract_call")) {
    const allowed = KNOWN_CONTRACTS[policy.chain] || [];
    const ok = allowed.some(a => a.toLowerCase() === (action.toAddress||"").toLowerCase());
    if (!ok) { pass = false; reason = `contract ${(action.toAddress||"").slice(0,8)}… not on allowlist`; }
    checks.push({ ok, k: "allowlist" });
  }
  if (pass && spendUSD > capUSD) { pass = false; reason = `$${spendUSD.toFixed(0)} > cap $${capUSD.toFixed(0)}`; }
  if (pass && action.kind === "swap" && (action.maxSlippage??0) <= 0) { pass = false; reason = "slippage not declared"; }
  gates.push({ name: "policy", pass, reason, checks });
  if (!pass) return { gates, finalStatus: "rejected", finalGate: 0 };

  let simPass = true, simReason = "no revert";
  if (action.kind === "contract_call" && Math.random() < 0.05) { simPass = false; simReason = "would revert"; }
  const gas = Math.floor((21000 + Math.random()*80000) * policy.gasBufferMultiplier);
  gates.push({ name: "simulate", pass: simPass, reason: simReason, gas });
  if (!simPass) return { gates, finalStatus: "reverted", finalGate: 1 };

  if (spendUSD >= policy.approvalThreshold) {
    gates.push({ name: "approve", pass: false, reason: "above threshold" });
    return { gates, finalStatus: "approval", finalGate: 2 };
  }
  gates.push({ name: "approve", pass: true, reason: "skipped", skipped: true });

  const txHash = "0x" + Array.from({length: 12}, () => Math.floor(Math.random()*16).toString(16)).join("");
  gates.push({ name: "execute", pass: true, reason: "broadcast", txHash });
  return { gates, finalStatus: "executed", finalGate: 3 };
};

// Ambient action generator — biased by mode
window.makeAmbientAction = function makeAmbientAction(policyChain, mode) {
  const adversary = mode === "adversary";

  // chain choice: 80% same-chain in normal, 50% in adversary
  const sameChain = Math.random() < (adversary ? 0.5 : 0.85);
  const chain = sameChain ? policyChain : window.CHAINS_ALL[Math.floor(Math.random() * window.CHAINS_ALL.length)];

  // kind
  let kind;
  const kr = Math.random();
  if (adversary) kind = kr < 0.4 ? "contract_call" : kr < 0.75 ? "swap" : "transfer";
  else           kind = kr < 0.55 ? "transfer" : kr < 0.85 ? "swap" : "contract_call";

  // token
  const tokens = ["ETH","USDC","USDT"];
  const token = tokens[Math.floor(Math.random()*tokens.length)];

  // amount distribution — adversary probes the cap edge
  let amount;
  if (adversary) {
    const r = Math.random();
    if (r < 0.4) amount = (Math.random() * 0.95 + 0.7) * 0.5; // small
    else if (r < 0.75) amount = (1 + Math.random() * 1.5);     // around cap (relative)
    else amount = 5 + Math.random() * 50;                      // huge
  } else {
    const r = Math.random();
    if (r < 0.65) amount = 0.05 + Math.random()*0.5;
    else if (r < 0.9) amount = 0.5 + Math.random()*4;
    else amount = 4 + Math.random()*20;
  }

  // contract address — adversary tries random ones (= not on allowlist)
  let to;
  if (kind !== "transfer") {
    if (adversary) {
      to = Math.random() < 0.7
        ? "0x" + Array.from({length:40},()=>Math.floor(Math.random()*16).toString(16)).join("")
        : (KNOWN_CONTRACTS[chain]||["0xe592427a0aece92de3edee1f18e0157c05861564"])[0];
    } else {
      to = Math.random() < 0.7
        ? (KNOWN_CONTRACTS[chain]||["0xe592427a0aece92de3edee1f18e0157c05861564"])[0]
        : "0x" + Array.from({length:40},()=>Math.floor(Math.random()*16).toString(16)).join("");
    }
  } else {
    to = "0x" + Array.from({length:40},()=>Math.floor(Math.random()*16).toString(16)).join("");
  }

  return {
    kind, chain, token, toAddress: to,
    amount: +amount.toFixed(token === "ETH" ? 3 : 2),
    maxSlippage: kind === "swap" ? 50 : 0,
    threadId: 1 + Math.floor(Math.random() * 3),
  };
};

window.GATES = ["policy","simulate","approve","execute"];
