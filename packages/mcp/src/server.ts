import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { TxfenceConfig } from './config.js'
import { registerSimulateTool } from './tools/simulate.js'
import { registerCheckPolicyTool } from './tools/check-policy.js'
import { registerSubmitTool } from './tools/submit.js'
import { registerGetReceiptTool } from './tools/get-receipt.js'
import { registerExplainRejectionTool } from './tools/explain-rejection.js'
import { registerDiffPoliciesTool } from './tools/diff-policies.js'

export async function startServer(config: TxfenceConfig): Promise<void> {
  const server = new McpServer({ name: 'txfence', version: '0.0.1' })

  registerSimulateTool(server, config)
  registerCheckPolicyTool(server, config)
  registerSubmitTool(server, config)
  registerGetReceiptTool(server, config)
  registerExplainRejectionTool(server, config)
  registerDiffPoliciesTool(server, config)

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('txfence MCP server running')
}
