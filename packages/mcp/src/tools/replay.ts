import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { replayAuditLog } from '@txfence/core'
import type { ChainId } from '@txfence/core'
import { createFileAuditLog } from '@txfence/audit'
import type { TxfenceConfig } from '../config.js'
import { bigintReplacer, textResult } from './shared.js'

export function registerReplayTool(server: McpServer, config: TxfenceConfig): void {
  server.tool(
    'txfence_replay_audit_log',
    'Replay historical audit log entries against a new policy configuration. Answers: "If this policy had been active, which transactions would have been rejected that weren\'t, and vice versa?" Useful for safely tuning policies before deploying them. Requires a JSONL audit log file path.',
    {
      auditLogPath: z.string().describe('path to the audit log JSONL file'),
      from: z.number().int().optional().describe('replay entries from this timestamp (ms since epoch)'),
      to: z.number().int().optional().describe('replay entries up to this timestamp (ms since epoch)'),
      actionKind: z.enum(['transfer', 'swap', 'contract_call']).optional(),
      chain: z.string().optional(),
      onlyChanged: z.boolean().default(false),
    },
    async (input) => {
      const auditLog = createFileAuditLog(input.auditLogPath)
      const result = await replayAuditLog(auditLog, config.policy, {
        ...(input.from !== undefined ? { from: input.from } : {}),
        ...(input.to !== undefined ? { to: input.to } : {}),
        ...(input.actionKind !== undefined ? { actionKind: input.actionKind } : {}),
        ...(input.chain !== undefined ? { chain: input.chain as ChainId } : {}),
        ...(input.onlyChanged ? { onlyChanged: true } : {}),
      })

      return textResult(JSON.stringify({
        summary: result.summary,
        replayedAt: result.replayedAt,
        changedEntries: result.entries
          .filter(e => e.changed)
          .map(e => ({
            auditEntryId: e.auditEntryId,
            timestamp: e.timestamp,
            direction: e.direction,
            actionKind: e.action.kind,
            chain: e.action.chain,
            originalPassed: e.originalEvaluation.passed,
            originalRejectionReason: e.originalEvaluation.rejectionReason,
            replayPassed: e.replayEvaluation.passed,
            replayRejectionReason: e.replayEvaluation.rejectionReason,
            changedChecks: e.changedChecks.map(c => c.checkName),
          })),
      }, bigintReplacer, 2))
    },
  )
}
