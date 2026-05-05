import { Command } from 'commander'
import { existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

export function makeInitCommand(): Command {
  const cmd = new Command('init')
    .description('Scaffold a txfence.config.ts in the current directory')
    .option('--force', 'overwrite existing config file')

  cmd.action((opts: { force?: boolean }) => {
    const configPath = resolve('./txfence.config.ts')

    if (existsSync(configPath) && !opts.force) {
      console.error('txfence.config.ts already exists. Use --force to overwrite.')
      process.exit(1)
    }

    const template = `import { defineConfig, env } from '@txfence/mcp'
import { simulateEvmAction, executeEvmAction, privateKeySigner } from '@txfence/evm'

export default defineConfig({
  // chains this agent is allowed to operate on
  chains: ['ethereum'],

  // chain adapters: one per chain
  adapters: {
    ethereum: { simulate: simulateEvmAction },
  },

  // RPC endpoints: use a private endpoint in production
  rpcUrls: {
    ethereum: 'https://ethereum.publicnode.com',
  },

  // base policy: all agent actions are evaluated against this
  policy: {
    chains: ['ethereum'],

    // maximum spend per transaction
    maxSpendPerTx: { token: 'USDC', amount: 1000n, decimals: 6 },

    // contracts this agent is allowed to interact with
    // add entries with optional bytecodeHash and ownerAddress for metadata verification
    allowedContracts: [],

    // require simulation before every execution
    requireSimulation: true,

    // minimum gas buffer multiplier applied to simulation estimates
    gasBufferMultiplier: 1.2,

    // transactions above this threshold require human approval
    humanApprovalThreshold: { token: 'USDC', amount: 10000n, decimals: 6 },

    // how long to wait for human approval before cancelling (ms)
    humanApprovalTimeoutMs: 30000,

    // cap lock mode: per-agent (default) or shared (for multi-agent environments)
    capLockMode: 'per-agent',
  },

  // signer: required for live execution (dryRun: false)
  // never hardcode private keys — use environment variables
  // signer: privateKeySigner(env('AGENT_PRIVATE_KEY') as \`0x\${string}\`),
})
`

    writeFileSync(configPath, template, 'utf-8')
    console.log('created txfence.config.ts')
    console.log('')
    console.log('next steps:')
    console.log('  1. add your RPC endpoint to rpcUrls')
    console.log('  2. add allowed contracts to policy.allowedContracts')
    console.log('  3. set AGENT_PRIVATE_KEY in your .env file and uncomment the signer')
    console.log('  4. run: txfence check-policy --kind transfer --chain ethereum --to 0x... --token ETH --amount 1000000000000000000')
    process.exit(0)
  })

  return cmd
}
