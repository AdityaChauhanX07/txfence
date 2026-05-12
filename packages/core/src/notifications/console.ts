import type { NotificationProvider, NotificationEvent } from './types.js'
import { formatExecutionFailureReason } from '../types/receipt.js'

export type ConsoleNotificationOptions = {
  prefix?: string
  logLevel?: 'log' | 'info' | 'warn' | 'error'
}

export function createConsoleNotificationProvider(
  options?: ConsoleNotificationOptions,
): NotificationProvider {
  const prefix = options?.prefix ?? '[txfence]'
  const logFn = options?.logLevel === 'log' ? console.log
    : options?.logLevel === 'info' ? console.info
    : options?.logLevel === 'warn' ? console.warn
    : options?.logLevel === 'error' ? console.error
    : console.log

  return {
    async notify(event: NotificationEvent): Promise<void> {
      switch (event.kind) {
        case 'approval_requested':
          logFn(`${prefix} approval_requested: ${event.action.kind} on ${event.action.chain}, threshold ${event.thresholdAmount} ${event.thresholdToken}, expires ${new Date(event.expiresAt).toISOString()}`)
          break
        case 'approval_decision':
          logFn(`${prefix} approval_decision: ${event.decision} for ${event.action.kind} on ${event.action.chain}`)
          break
        case 'policy_rejected':
          logFn(`${prefix} policy_rejected: ${event.reason} for ${event.action.kind} on ${event.action.chain}`)
          break
        case 'execution_success':
          logFn(`${prefix} execution_success: ${event.receipt.action.kind} on ${event.receipt.action.chain}, txHash=${event.receipt.txHash}`)
          break
        case 'execution_failed':
          logFn(`${prefix} execution_failed: ${formatExecutionFailureReason(event.reason)} for ${event.action.kind} on ${event.action.chain}`)
          break
        case 'cap_warning':
          logFn(`${prefix} cap_warning: ${event.event.capId} at ${event.event.pctUsed.toFixed(1)}% (${event.event.currentAmount}/${event.event.capAmount} ${event.event.token})`)
          break
        case 'monitor_unrecorded':
          logFn(`${prefix} monitor_unrecorded [${event.severity}]: txHash=${event.txHash} on ${event.chain} block ${event.blockNumber}`)
          break
        case 'monitor_reorg':
          logFn(`${prefix} monitor_reorg: txHash=${event.txHash} on ${event.chain}, originalBlock=${event.originalBlock}`)
          break
      }
    },
  }
}
