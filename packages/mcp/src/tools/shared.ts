import { z } from 'zod'
import type { Action, Policy, ChainId, TokenAmount } from '@txfence/core'
import { bigintReplacer } from '@txfence/core'

export { bigintReplacer }

export const tokenAmountSchema = z.object({
  token: z.string(),
  amount: z.string(),
  decimals: z.number(),
})

export const actionSchema = z.object({
  kind: z.enum(['swap', 'transfer', 'contract_call']),
  chain: z.string(),
  from: tokenAmountSchema.optional(),
  to: z.string().optional(),
  via: z.string().optional(),
  maxSlippage: z.number().optional(),
  token: tokenAmountSchema.optional(),
  contract: z.string().optional(),
  method: z.string().optional(),
  args: z.array(z.unknown()).optional(),
  value: tokenAmountSchema.optional(),
})

export const policySchema = z.object({
  chains: z.array(z.string()),
  maxSpendPerTx: tokenAmountSchema,
  allowedContracts: z.array(z.object({
    address: z.string(),
    chain: z.string(),
    bytecodeHash: z.string().optional(),
    ownerAddress: z.string().optional(),
    expiresAt: z.number().optional(),
  })),
  requireSimulation: z.boolean(),
  gasBufferMultiplier: z.number(),
  humanApprovalThreshold: tokenAmountSchema,
  humanApprovalTimeoutMs: z.number(),
  capLockMode: z.enum(['per-agent', 'shared']),
})

export type ActionInput = z.output<typeof actionSchema>
export type PolicyInput = z.output<typeof policySchema>

function toTokenAmount(input: z.output<typeof tokenAmountSchema>): TokenAmount {
  return { token: input.token, amount: BigInt(input.amount), decimals: input.decimals }
}

export function buildAction(input: ActionInput): Action {
  const chain = input.chain as ChainId
  switch (input.kind) {
    case 'transfer':
      return {
        kind: 'transfer',
        chain,
        token: toTokenAmount(input.token!),
        to: input.to!,
      }
    case 'swap':
      return {
        kind: 'swap',
        chain,
        from: toTokenAmount(input.from!),
        to: input.to!,
        via: input.via!,
        maxSlippage: input.maxSlippage!,
      }
    case 'contract_call': {
      const base = {
        kind: 'contract_call' as const,
        chain,
        contract: input.contract!,
        method: input.method!,
        args: input.args ?? [],
      }
      return input.value !== undefined
        ? { ...base, value: toTokenAmount(input.value) }
        : base
    }
  }
}

export function buildPolicy(input: PolicyInput): Policy {
  return {
    chains: input.chains as ChainId[],
    maxSpendPerTx: toTokenAmount(input.maxSpendPerTx),
    allowedContracts: input.allowedContracts.map(c => ({
      address: c.address,
      chain: c.chain as ChainId,
      ...(c.bytecodeHash !== undefined ? { bytecodeHash: c.bytecodeHash } : {}),
      ...(c.ownerAddress !== undefined ? { ownerAddress: c.ownerAddress } : {}),
      ...(c.expiresAt !== undefined ? { expiresAt: c.expiresAt } : {}),
    })),
    requireSimulation: input.requireSimulation,
    gasBufferMultiplier: input.gasBufferMultiplier,
    humanApprovalThreshold: toTokenAmount(input.humanApprovalThreshold),
    humanApprovalTimeoutMs: input.humanApprovalTimeoutMs,
    capLockMode: input.capLockMode,
  }
}

export function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}

export function errorResult(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true as const }
}
