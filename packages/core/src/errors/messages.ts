import type { PolicyRejectionReason } from '../types/receipt.js'
import type { BoundAction } from '../types/action.js'
import type { SimulationResult } from '../types/simulation.js'

export function getPolicyRejectionMessage(reason: PolicyRejectionReason, action: BoundAction): string {
  const act = action.action

  switch (reason) {
    case 'chain_not_allowed':
      return `action targets chain "${act.chain}" which is not in the allowed chains: [${action.policy.chains.join(', ')}]`

    case 'contract_not_allowed':
      if (act.kind === 'swap') return `contract "${act.via}" is not on the allowlist for chain "${act.chain}"`
      if (act.kind === 'contract_call') return `contract "${act.contract}" is not on the allowlist for chain "${act.chain}"`
      return `transfer target is not on the allowlist`

    case 'spend_exceeds_cap':
      if (act.kind === 'swap') return `spend of ${act.from.amount} ${act.from.token} exceeds per-tx cap of ${action.policy.maxSpendPerTx.amount} ${action.policy.maxSpendPerTx.token}`
      if (act.kind === 'transfer') return `transfer of ${act.token.amount} ${act.token.token} exceeds per-tx cap of ${action.policy.maxSpendPerTx.amount} ${action.policy.maxSpendPerTx.token}`
      if (act.kind === 'contract_call' && act.value !== undefined) return `value of ${act.value.amount} ${act.value.token} exceeds per-tx cap of ${action.policy.maxSpendPerTx.amount} ${action.policy.maxSpendPerTx.token}`
      return `spend exceeds per-tx cap of ${action.policy.maxSpendPerTx.amount} ${action.policy.maxSpendPerTx.token}`

    case 'slippage_not_declared':
      return `swap action requires a slippage tolerance greater than 0 — set maxSlippage in your action`

    case 'simulation_required_but_failed':
      return `policy requires simulation but simulation failed or was not provided`

    case 'gas_buffer_insufficient':
      return `gas buffer applied is below the required multiplier of ${action.policy.gasBufferMultiplier}x`

    case 'cap_lock_unavailable':
      return `spend cap lock could not be acquired — another agent may have reached the cap limit`

    case 'bytecode_hash_mismatch':
      if (act.kind === 'swap') return `bytecode hash mismatch for contract "${act.via}" — the contract may have been upgraded or replaced`
      if (act.kind === 'contract_call') return `bytecode hash mismatch for contract "${act.contract}" — the contract may have been upgraded or replaced`
      return `bytecode hash mismatch — the contract may have been upgraded or replaced`

    case 'owner_address_mismatch':
      if (act.kind === 'swap') return `owner address mismatch for contract "${act.via}" — ownership may have been transferred`
      if (act.kind === 'contract_call') return `owner address mismatch for contract "${act.contract}" — ownership may have been transferred`
      return `owner address mismatch — ownership may have been transferred`

    case 'contract_entry_expired':
      if (act.kind === 'swap') return `allowlist entry for contract "${act.via}" has expired`
      if (act.kind === 'contract_call') return `allowlist entry for contract "${act.contract}" has expired`
      return `allowlist entry has expired`

    case 'chain_id_mismatch':
      return `chain ID mismatch — the connected provider is on a different chain than expected`

    case 'temporal_rule_triggered':
      return `temporal rule triggered — action rejected based on agent behavior over time`
  }
}

export function getSimulationFailureMessage(simulation: SimulationResult): string {
  return (
    `simulation failed on chain "${simulation.chain}" at block ${simulation.simulatedAtBlock}. ` +
    `coverage: ${simulation.coverageLevel}. ` +
    `caveats: ${simulation.caveats.join(', ') || 'none'}`
  )
}
