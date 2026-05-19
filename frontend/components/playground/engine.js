// Policy evaluation engine + action factory.
// Exposes globals on window for cross-script use (Babel scopes).

window.GATES = ["chain", "amount", "target", "approve"];
window.CHAINS_ALL = ["ethereum", "arbitrum", "optimism", "base", "solana", "cosmoshub", "osmosis"];
window.TOKENS_ALL = ["USDC", "USDT", "DAI", "WETH", "WBTC", "SOL", "ATOM", "OSMO"];
window.KINDS_ALL  = ["transfer", "swap", "approve", "stake", "bridge"];

const PRICES = { USDC: 1, USDT: 1, DAI: 1, WETH: 3200, WBTC: 64000, SOL: 165, ATOM: 8.4, OSMO: 0.55 };
window.toUSD = (amount, token) => amount * (PRICES[token] || 1);

const KNOWN = new Set([
  "0xe592427a0aece92de3edee1f18e0157c05861564", // uni router
  "0x111111125421ca6dc452d289314280a0f8842a65", // 1inch
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff", // 0x
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", // uni router 2
]);

const ALLOWED_BY_CHAIN = {
  ethereum: ["transfer", "swap", "approve", "stake", "bridge"],
  arbitrum: ["transfer", "swap", "approve", "bridge"],
  optimism: ["transfer", "swap", "approve", "bridge"],
  base:     ["transfer", "swap", "approve"],
  solana:   ["transfer", "swap", "stake"],
  cosmoshub:["transfer", "stake"],
  osmosis:  ["transfer", "swap"],
};

window.defaultPolicy = () => ({
  chain: "ethereum",
  maxSpendAmount: 5000,
  maxSpendToken: "USDC",
  approvalThreshold: 10000,
  gasBufferMultiplier: 1.20,
});

// evaluate: returns { gates, finalGate, finalStatus, reason }
// finalGate: index into GATES at which evaluation halted (or 3 if executed)
// finalStatus: "executed" | "rejected" | "approval"
window.evaluate = (policy, action) => {
  const gates = [];

  // 1. chain
  if (action.chain !== policy.chain) {
    return { gates, finalGate: 0, finalStatus: "rejected", reason: "chain_not_allowed" };
  }
  if (!(ALLOWED_BY_CHAIN[action.chain] || []).includes(action.kind)) {
    return { gates, finalGate: 0, finalStatus: "rejected", reason: "kind_not_supported_on_chain" };
  }
  gates.push("chain");

  // 2. amount
  const usd = window.toUSD(action.amount, action.token);
  const capUSD = window.toUSD(policy.maxSpendAmount, policy.maxSpendToken);
  if (usd > capUSD) {
    return { gates, finalGate: 1, finalStatus: "rejected", reason: "spend_cap_exceeded" };
  }
  if (action.kind === "swap" && (action.maxSlippage || 0) > 100) {
    return { gates, finalGate: 1, finalStatus: "rejected", reason: "slippage_overrun" };
  }
  gates.push("amount");

  // 3. target
  if (action.kind === "swap" || action.kind === "approve" || action.kind === "stake") {
    const t = (action.toAddress || "").toLowerCase();
    if (!KNOWN.has(t)) {
      return { gates, finalGate: 2, finalStatus: "rejected", reason: "target_not_allowlisted" };
    }
  }
  // bridge: random 8% sim-revert at target gate
  if (action.kind === "bridge" && Math.random() < 0.08) {
    return { gates, finalGate: 2, finalStatus: "rejected", reason: "sim_revert_insufficient_dest_liquidity" };
  }
  gates.push("target");

  // 4. approve (HITL)
  if (usd >= policy.approvalThreshold) {
    return { gates, finalGate: 3, finalStatus: "approval", reason: "human_approval_required" };
  }
  gates.push("approve");

  return { gates, finalGate: 3, finalStatus: "executed", reason: "ok" };
};

// Random short-ish hex
function randAddr() {
  const hex = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 40; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

const KNOWN_ARR = Array.from(KNOWN);
let threadCursor = 0;

window.makeAmbientAction = (policyChain, mode) => {
  threadCursor = (threadCursor + 1) % 3;
  const threadId = threadCursor + 1;

  // weighted kinds
  const r = Math.random();
  let kind;
  if (mode === "adversary") {
    kind = r < 0.30 ? "transfer" : r < 0.55 ? "swap" : r < 0.72 ? "approve" : r < 0.88 ? "stake" : "bridge";
  } else {
    kind = r < 0.45 ? "transfer" : r < 0.78 ? "swap" : r < 0.90 ? "approve" : r < 0.97 ? "stake" : "bridge";
  }

  // chain — usually policyChain, sometimes off
  const chainP = mode === "adversary" ? 0.55 : 0.85;
  const chain = Math.random() < chainP ? policyChain : window.CHAINS_ALL[Math.floor(Math.random() * window.CHAINS_ALL.length)];

  const tokens = ["USDC", "USDT", "DAI", "WETH"];
  const token = tokens[Math.floor(Math.random() * tokens.length)];

  // amount — sometimes spike
  let amount;
  const sizeRoll = Math.random();
  if (mode === "adversary" && sizeRoll < 0.18) {
    amount = 8000 + Math.random() * 60000; // big
  } else if (sizeRoll < 0.50) {
    amount = 5 + Math.random() * 80;
  } else if (sizeRoll < 0.85) {
    amount = 80 + Math.random() * 1200;
  } else {
    amount = 1200 + Math.random() * 4500;
  }
  if (token === "WETH") amount = amount / 3200;

  amount = +amount.toFixed(token === "WETH" ? 4 : 2);

  // target
  let toAddress;
  if (kind === "transfer") {
    toAddress = randAddr();
  } else {
    const knownP = mode === "adversary" ? 0.55 : 0.82;
    toAddress = Math.random() < knownP ? KNOWN_ARR[Math.floor(Math.random() * KNOWN_ARR.length)] : randAddr();
  }

  const maxSlippage = kind === "swap" ? (Math.random() < 0.05 && mode === "adversary" ? 250 : 30 + Math.random() * 60) : 0;

  return { kind, chain, token, amount, toAddress, maxSlippage, threadId };
};
