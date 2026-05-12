import type { Policy } from '../types/policy.js'
import type { ConfigValidationResult, ConfigWarning } from './types.js'

const KNOWN_DECIMALS: Record<string, number> = {
  ETH:  18,
  WETH: 18,
  WBTC: 8,
  BTC:  8,
  USDC: 6,
  USDT: 6,
  DAI:  18,
  MATIC: 18,
  BNB:  18,
  SOL:  9,
  ATOM: 6,
  OSMO: 6,
}

export function validateConfig(policy: Policy): ConfigValidationResult {
  const errors: ConfigWarning[] = []
  const warnings: ConfigWarning[] = []

  function addError(field: string, message: string): void {
    errors.push({ field, severity: 'error', message })
  }

  function addWarning(field: string, message: string): void {
    warnings.push({ field, severity: 'warning', message })
  }

  // ── Errors ────────────────────────────────────────────────────────────────

  if (policy.chains.length === 0) {
    addError('chains', 'Policy has no allowed chains — no actions can ever pass')
  }

  if (policy.gasBufferMultiplier < 1.0) {
    addError(
      'gasBufferMultiplier',
      `gasBufferMultiplier is ${policy.gasBufferMultiplier} — must be >= 1.0 ` +
      `or every simulated transaction will fail the gas buffer check`,
    )
  }

  if (policy.humanApprovalTimeoutMs < 1000) {
    addError(
      'humanApprovalTimeoutMs',
      `humanApprovalTimeoutMs is ${policy.humanApprovalTimeoutMs}ms — ` +
      `approval windows under 1 second are not usable`,
    )
  }

  if (policy.maxSpendPerTx.decimals === 0) {
    addError(
      'maxSpendPerTx.decimals',
      `maxSpendPerTx.decimals is 0 — this is almost certainly wrong. ` +
      `USDC uses 6 decimals, ETH uses 18. A decimals value of 0 means ` +
      `amounts are treated as whole token units with no fractional precision.`,
    )
  }

  if (
    policy.humanApprovalThreshold.token === policy.maxSpendPerTx.token &&
    policy.humanApprovalThreshold.decimals !== policy.maxSpendPerTx.decimals
  ) {
    addError(
      'humanApprovalThreshold.decimals',
      `humanApprovalThreshold.decimals (${policy.humanApprovalThreshold.decimals}) ` +
      `does not match maxSpendPerTx.decimals (${policy.maxSpendPerTx.decimals}) ` +
      `for the same token (${policy.maxSpendPerTx.token}). ` +
      `Approval threshold comparisons will be wrong.`,
    )
  }

  // ── Warnings ──────────────────────────────────────────────────────────────

  const knownMaxDecimals = KNOWN_DECIMALS[policy.maxSpendPerTx.token.toUpperCase()]
  if (knownMaxDecimals !== undefined && policy.maxSpendPerTx.decimals !== knownMaxDecimals) {
    addWarning(
      'maxSpendPerTx.decimals',
      `maxSpendPerTx.decimals is ${policy.maxSpendPerTx.decimals} but ` +
      `${policy.maxSpendPerTx.token} typically uses ${knownMaxDecimals} decimals. ` +
      `If this is wrong, your spend cap is off by a factor of ` +
      `10^${Math.abs(policy.maxSpendPerTx.decimals - knownMaxDecimals)}. ` +
      `Double-check your decimals configuration.`,
    )
  }

  const knownThresholdDecimals = KNOWN_DECIMALS[policy.humanApprovalThreshold.token.toUpperCase()]
  if (
    knownThresholdDecimals !== undefined &&
    policy.humanApprovalThreshold.decimals !== knownThresholdDecimals
  ) {
    addWarning(
      'humanApprovalThreshold.decimals',
      `humanApprovalThreshold.decimals is ${policy.humanApprovalThreshold.decimals} but ` +
      `${policy.humanApprovalThreshold.token} typically uses ${knownThresholdDecimals} decimals. ` +
      `Double-check your decimals configuration.`,
    )
  }

  if (
    policy.humanApprovalThreshold.token === policy.maxSpendPerTx.token &&
    policy.humanApprovalThreshold.amount < policy.maxSpendPerTx.amount
  ) {
    addWarning(
      'humanApprovalThreshold.amount',
      `humanApprovalThreshold (${policy.humanApprovalThreshold.amount} ` +
      `${policy.humanApprovalThreshold.token}) is less than maxSpendPerTx ` +
      `(${policy.maxSpendPerTx.amount} ${policy.maxSpendPerTx.token}). ` +
      `Every transaction will require human approval since the threshold ` +
      `is below the maximum spend per transaction.`,
    )
  }

  if (policy.gasBufferMultiplier > 3.0) {
    addWarning(
      'gasBufferMultiplier',
      `gasBufferMultiplier is ${policy.gasBufferMultiplier} — values above 3.0 ` +
      `are unusual and will cause most transactions to appear to require ` +
      `significantly more gas than they actually use.`,
    )
  }

  if (policy.allowedContracts.length === 0 && !policy.requireSimulation) {
    addWarning(
      'allowedContracts',
      `allowedContracts is empty and requireSimulation is false. ` +
      `This is a very permissive policy — any contract on any allowed chain ` +
      `can be called without simulation. Consider adding contracts to ` +
      `allowedContracts or enabling requireSimulation.`,
    )
  }

  const now = Date.now()
  for (const entry of policy.allowedContracts) {
    if (entry.expiresAt !== undefined && entry.expiresAt < now) {
      addWarning(
        `allowedContracts[${entry.address}].expiresAt`,
        `Contract entry for ${entry.address} on ${entry.chain} expired at ` +
        `${new Date(entry.expiresAt).toISOString()}. ` +
        `Actions targeting this contract will be rejected with contract_entry_expired.`,
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
