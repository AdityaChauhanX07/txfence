import type { Policy, ChainId, AdapterMap, CapLockProvider, MetadataVerifier, Signer } from '@txfence/core'

export type TxfenceConfig = {
  chains: ChainId[]
  adapters: AdapterMap
  rpcUrls: Partial<Record<ChainId, string>>
  policy: Policy
  signer?: Signer
  capLockProvider?: CapLockProvider
  metadataVerifier?: MetadataVerifier
}

export function defineConfig(config: TxfenceConfig): TxfenceConfig {
  return config
}

export async function loadConfig(configPath: string): Promise<TxfenceConfig> {
  try {
    const mod = await import(configPath) as { default: TxfenceConfig }
    return mod.default
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error('failed to load txfence config from ' + configPath + ': ' + message)
  }
}
