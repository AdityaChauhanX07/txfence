// MEV protection broadcast implementation for EVM.
// Routes eth_sendRawTransaction through protected endpoints.
// Flashbots Protect: https://protect.flashbots.net
// MEV Blocker: https://rpc.mevblocker.io
//
// Both endpoints accept standard eth_sendRawTransaction JSON-RPC calls.
// The difference is only in where the transaction is sent, not how it
// is constructed, signed, or verified.

import type { MevProtectionMode, MevProtectionConfig } from '@txfence/core'

export function getMevProtectedRpcUrl(
  mode: MevProtectionMode | undefined,
  config?: MevProtectionConfig,
  fallbackRpcUrl?: string,
): string {
  switch (mode) {
    case 'flashbots':
      return config?.flashbots?.rpcUrl ?? 'https://rpc.flashbots.net'
    case 'mev-blocker':
      return config?.mevBlocker?.rpcUrl ?? 'https://rpc.mevblocker.io'
    case 'none':
    case undefined:
    default:
      return fallbackRpcUrl ?? 'https://ethereum.publicnode.com'
  }
}

// Full Flashbots auth signing requires an ECDSA secp256k1 signer.
// Implementing this would require importing viem's signMessage or
// ethers.js Wallet. For v1, we return undefined (unsigned requests).
// Unsigned requests are still protected — they just have no Flashbots
// reputation score. Auth signing is planned for v2.
export function buildFlashbotsAuthHeader(
  _body: string,
  _authSignerKey: string,
): string | undefined {
  return undefined
}

export async function broadcastWithMevProtection(
  signedTxHex: `0x${string}`,
  mode: MevProtectionMode | undefined,
  config?: MevProtectionConfig,
  fallbackRpcUrl?: string,
): Promise<string> {
  const rpcUrl = getMevProtectedRpcUrl(mode, config, fallbackRpcUrl)

  const body = JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_sendRawTransaction',
    params: [signedTxHex],
    id: 1,
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (mode === 'flashbots' && config?.flashbots?.authSignerKey !== undefined) {
    const authHeader = buildFlashbotsAuthHeader(body, config.flashbots.authSignerKey)
    if (authHeader !== undefined) {
      headers['X-Flashbots-Signature'] = authHeader
    }
  }

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers,
    body,
  })

  if (!response.ok) {
    throw new Error(
      `MEV-protected broadcast failed: ${response.status} ${await response.text()}`,
    )
  }

  const data = await response.json() as { result?: string; error?: { message: string } }

  if (data.error !== undefined) {
    throw new Error(`MEV-protected broadcast error: ${data.error.message}`)
  }

  if (data.result === undefined) {
    throw new Error('MEV-protected broadcast: no txHash in response')
  }

  return data.result
}
