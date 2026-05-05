import type { Action, ChainId } from '@txfence/core'
import { Command } from 'commander'

export function addActionOptions(cmd: Command): Command {
  return cmd
    .option('--kind <kind>', 'action kind: swap, transfer, contract_call (required)')
    .option('--chain <chain>', 'target chain: ethereum, solana, etc. (required)')
    .option('--to <address>', 'recipient address (for transfer) or output token (for swap)')
    .option('--from-token <token>', 'input token symbol (for swap)')
    .option('--from-amount <amt>', 'input amount as integer (for swap, in token base units)')
    .option('--token <token>', 'token symbol (for transfer)')
    .option('--amount <amt>', 'amount as integer in base units (for transfer)')
    .option('--via <address>', 'router contract address (for swap)')
    .option('--slippage <bps>', 'max slippage in basis points (for swap, default 50)', '50')
    .option('--contract <address>', 'contract address (for contract_call)')
    .option('--method <name>', 'method name (for contract_call)')
    .option('--value-token <token>', 'value token (for contract_call)')
    .option('--value-amount <amt>', 'value amount in base units (for contract_call)')
}

export function buildActionFromOptions(opts: Record<string, string>): Action {
  const chain = opts['chain'] as ChainId
  const kind = opts['kind']

  if (kind === 'transfer') {
    const to = opts['to']
    const token = opts['token']
    const amount = opts['amount']
    if (to === undefined || token === undefined || amount === undefined) {
      throw new Error('transfer requires --to, --token, and --amount')
    }
    return {
      kind: 'transfer',
      chain,
      token: { token, amount: BigInt(amount), decimals: 18 },
      to,
    }
  }

  if (kind === 'swap') {
    const to = opts['to']
    const fromToken = opts['fromToken']
    const fromAmount = opts['fromAmount']
    const via = opts['via']
    if (to === undefined || fromToken === undefined || fromAmount === undefined || via === undefined) {
      throw new Error('swap requires --to, --from-token, --from-amount, and --via')
    }
    return {
      kind: 'swap',
      chain,
      from: { token: fromToken, amount: BigInt(fromAmount), decimals: 18 },
      to,
      via,
      maxSlippage: Number(opts['slippage'] ?? '50'),
    }
  }

  if (kind === 'contract_call') {
    const contract = opts['contract']
    const method = opts['method']
    if (contract === undefined || method === undefined) {
      throw new Error('contract_call requires --contract and --method')
    }
    const valueToken = opts['valueToken']
    const valueAmount = opts['valueAmount']
    const base = {
      kind: 'contract_call' as const,
      chain,
      contract,
      method,
      args: [] as unknown[],
    }
    if (valueToken !== undefined && valueAmount !== undefined) {
      return { ...base, value: { token: valueToken, amount: BigInt(valueAmount), decimals: 18 } }
    }
    return base
  }

  throw new Error('--kind must be one of: swap, transfer, contract_call')
}
