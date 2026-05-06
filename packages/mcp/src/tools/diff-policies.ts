import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { diffPolicies, createTestActions } from '@txfence/core'
import type { TxfenceConfig } from '../config.js'
import { actionSchema, policySchema, buildAction, buildPolicy, bigintReplacer, textResult } from './shared.js'

export function registerDiffPoliciesTool(server: McpServer, _config: TxfenceConfig): void {
  server.tool(
    'txfence_diff_policies',
    'Compare two policy configurations and show which actions would be accepted by one but rejected by the other. Useful for understanding the blast radius of a policy change.',
    {
      policyA: policySchema,
      policyB: policySchema,
      actions: z.array(actionSchema).optional(),
    },
    async (args) => {
      const policyA = buildPolicy(args.policyA)
      const policyB = buildPolicy(args.policyB)

      const actionsList =
        args.actions !== undefined
          ? args.actions.map(a => ({ action: buildAction(a) }))
          : createTestActions(policyA)

      const diff = diffPolicies({ policyA, policyB, actions: actionsList })

      return textResult(JSON.stringify(diff, bigintReplacer, 2))
    },
  )
}
