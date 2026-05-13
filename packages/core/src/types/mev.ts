// MEV protection types.
// MEV (Maximal Extractable Value) protection routes transactions through
// private channels that bypass the public mempool, preventing sandwich
// attacks, frontrunning, and other forms of MEV extraction.
//
// mevProtection is a per-transaction policy field — different action types
// can use different protection levels. Swaps on mainnet should use
// 'flashbots' or 'mev-blocker'. Internal transfers can use 'none'.
//
// MEV protection only applies to EVM chains. Solana and Cosmos adapters
// ignore this field.

export type MevProtectionMode =
  | 'flashbots'    // Flashbots Protect — https://rpc.flashbots.net
  | 'mev-blocker'  // MEV Blocker (CoW Protocol) — https://rpc.mevblocker.io
  | 'none'         // Standard public mempool (default)

export type FlashbotsConfig = {
  rpcUrl?: string          // default: 'https://rpc.flashbots.net'
  authSignerKey?: string   // optional: private key for Flashbots reputation scoring
                           // if not provided, requests are sent unsigned (still protected)
}

export type MevBlockerConfig = {
  rpcUrl?: string          // default: 'https://rpc.mevblocker.io'
}

export type MevProtectionConfig = {
  flashbots?: FlashbotsConfig
  mevBlocker?: MevBlockerConfig
}
