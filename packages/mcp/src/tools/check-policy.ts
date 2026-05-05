import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { evaluate } from '@txfence/core'
import type { TxfenceConfig } from '../config.js'
import { actionSchema, policySchema, buildAction, buildPolicy, bigintReplacer, textResult } from './shared.js'

export function registerCheckPolicyTool(server: McpServer, _config: TxfenceConfig): void {
  server.tool(
    'txfence_check_policy',
    'Evaluate an action against a policy without simulation or execution. Returns every check that was run and the rejection reason if any failed.',
    { action: actionSchema, policy: policySchema },
    async (args) => {
      const action = buildAction(args.action)
      const policy = buildPolicy(args.policy)
      const boundAction = { action, policy }
      const result = evaluate(boundAction)
      return textResult(JSON.stringify(result, bigintReplacer, 2))
    },
  )
}
