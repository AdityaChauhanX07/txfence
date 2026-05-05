import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getPolicyRejectionMessage } from '@txfence/core'
import type { PolicyRejectionReason } from '@txfence/core'
import type { TxfenceConfig } from '../config.js'
import { actionSchema, policySchema, buildAction, buildPolicy, textResult } from './shared.js'

export function registerExplainRejectionTool(server: McpServer, _config: TxfenceConfig): void {
  server.tool(
    'txfence_explain_rejection',
    'Return a human-readable explanation of a policy rejection.',
    { rejectionReason: z.string(), action: actionSchema, policy: policySchema },
    async (args) => {
      const action = buildAction(args.action)
      const policy = buildPolicy(args.policy)
      const boundAction = { action, policy }
      const message = getPolicyRejectionMessage(
        args.rejectionReason as PolicyRejectionReason,
        boundAction,
      )
      return textResult(JSON.stringify({ explanation: message }, null, 2))
    },
  )
}
