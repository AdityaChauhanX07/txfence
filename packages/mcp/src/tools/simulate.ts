import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ChainId } from '@txfence/core'
import type { TxfenceConfig } from '../config.js'
import { actionSchema, buildAction, bigintReplacer, textResult, errorResult } from './shared.js'

export function registerSimulateTool(server: McpServer, config: TxfenceConfig): void {
  server.tool(
    'txfence_simulate',
    'Simulate an on-chain action without executing it. Returns gas estimate, coverage level, and caveats.',
    { action: actionSchema, rpcUrl: z.string().optional() },
    async (args) => {
      const action = buildAction(args.action)
      const rpcUrl = args.rpcUrl ?? config.rpcUrls[action.chain as ChainId]
      if (rpcUrl === undefined) {
        return errorResult('no rpcUrl configured for chain: ' + action.chain)
      }
      const adapter = config.adapters[action.chain as ChainId]
      if (adapter === undefined) {
        return errorResult('no adapter configured for chain: ' + action.chain)
      }
      const result = await adapter.simulate(action, action.chain as ChainId, rpcUrl)
      return textResult(JSON.stringify(result, bigintReplacer, 2))
    },
  )
}
