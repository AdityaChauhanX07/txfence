import { pathToFileURL } from 'url'
import { z } from 'zod'
import type { Policy, ChainId, AdapterMap, CapLockProvider, MetadataVerifier, Signer, IntentExecutionOptions } from '@txfence/core'

export type TxfenceConfig = {
  chains: ChainId[]
  adapters: AdapterMap
  rpcUrls: Partial<Record<ChainId, string>>
  policy: Policy
  signer?: Signer
  capLockProvider?: CapLockProvider
  metadataVerifier?: MetadataVerifier
  executor?: IntentExecutionOptions['executor']
}

export function defineConfig(config: TxfenceConfig): TxfenceConfig {
  return config
}

export function env(key: string): string {
  const value = process.env[key]
  if (value === undefined || value === '') {
    throw new Error(
      `required environment variable "${key}" is not set. ` +
      `Add it to your .env file or shell environment before starting txfence.`
    )
  }
  return value
}

export function envOptional(key: string): string | undefined {
  return process.env[key]
}

const tokenAmountSchema = z.object({
  token: z.string(),
  amount: z.bigint(),
  decimals: z.number(),
})

const contractEntrySchema = z.object({
  address: z.string(),
  chain: z.string(),
  bytecodeHash: z.string().optional(),
  ownerAddress: z.string().optional(),
  expiresAt: z.number().optional(),
})

const policySchema = z.object({
  chains: z.array(z.string()).min(1, 'policy.chains must contain at least one chain'),
  maxSpendPerTx: tokenAmountSchema,
  allowedContracts: z.array(contractEntrySchema),
  requireSimulation: z.boolean(),
  gasBufferMultiplier: z.number().min(1, 'policy.gasBufferMultiplier must be at least 1.0'),
  humanApprovalThreshold: tokenAmountSchema,
  humanApprovalTimeoutMs: z.number().positive(),
  capLockMode: z.enum(['per-agent', 'shared']),
})

const configSchema = z.object({
  chains: z.array(z.string()).min(1, 'chains must contain at least one chain'),
  adapters: z.record(z.object({ simulate: z.function() })),
  rpcUrls: z.record(z.string().url('rpcUrls values must be valid URLs')),
  policy: policySchema,
  signer: z.object({
    address: z.string(),
    sign: z.function(),
  }).optional(),
  capLockProvider: z.object({
    acquire: z.function(),
    release: z.function(),
    commit: z.function(),
  }).optional(),
  metadataVerifier: z.object({
    verifyContract: z.function(),
  }).optional(),
})

export async function loadConfig(configPath: string): Promise<TxfenceConfig> {
  try {
    const fileUrl = pathToFileURL(configPath).href
    const mod = await import(fileUrl) as { default: TxfenceConfig }
    const raw = mod.default
    const result = configSchema.safeParse(raw)
    if (!result.success) {
      const messages = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`)
      throw new Error(
        `invalid txfence config at ${configPath}:\n${messages.join('\n')}`
      )
    }
    return raw
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('invalid txfence config')) {
      throw err
    }
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`failed to load txfence config from ${configPath}: ${message}`)
  }
}
