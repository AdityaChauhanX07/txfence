import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { validateConfig } from '@txfence/core'
import type { TxfenceConfig } from '../config.js'
import { policySchema, buildPolicy, bigintReplacer, textResult } from './shared.js'

export function registerValidateConfigTool(server: McpServer, _config: TxfenceConfig): void {
  server.tool(
    'txfence_validate_config',
    'Validate a policy configuration and get domain-aware warnings about potential misconfigurations. Catches decimals mismatches, unusable thresholds, expired contract entries, and other issues that cause unexpected behavior in production.',
    { policy: policySchema },
    async (args) => {
      const policy = buildPolicy(args.policy)
      const result = validateConfig(policy)
      return textResult(JSON.stringify(result, bigintReplacer, 2))
    },
  )
}
