#!/usr/bin/env npx tsx

import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { platform } from 'node:process'

const processes: ChildProcess[] = []

function spawnProcess(
  command: string,
  args: string[],
  label: string,
  color: string,
): ChildProcess {
  const isWindows = platform === 'win32'
  const shell = isWindows ? 'cmd.exe' : '/bin/sh'
  const shellFlag = isWindows ? '/c' : '-c'
  const fullCommand = `${command} ${args.join(' ')}`

  const child = spawn(shell, [shellFlag, fullCommand], {
    stdio: ['inherit', 'pipe', 'pipe'],
  })

  child.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    lines.forEach(line => console.log(`${color}[${label}]\x1b[0m ${line}`))
  })

  child.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    lines.forEach(line => console.error(`${color}[${label}]\x1b[0m ${line}`))
  })

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${color}[${label}]\x1b[0m exited with code ${code}`)
    }
  })

  return child
}

function cleanup(): void {
  processes.forEach(p => {
    try { p.kill() } catch {}
  })
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

console.log('\x1b[36m[dev]\x1b[0m Starting txfence development environment...\n')

// Check if anvil is available
const anvilCheck = spawn('anvil', ['--version'], { stdio: 'ignore' })
anvilCheck.on('error', () => {
  console.log('\x1b[33m[dev]\x1b[0m anvil not found — skipping Anvil.')
  console.log('\x1b[33m[dev]\x1b[0m Install Foundry to run integration tests:')
  console.log('\x1b[33m[dev]\x1b[0m   curl -L https://foundry.paradigm.xyz | bash\n')
})
anvilCheck.on('exit', (code) => {
  if (code === 0) {
    console.log('\x1b[32m[dev]\x1b[0m Starting Anvil...')
    const anvil = spawnProcess(
      'anvil',
      [
        '--fork-url', process.env.ETHEREUM_RPC_URL ?? 'https://ethereum.publicnode.com',
        '--port', '8545',
        '--host', '0.0.0.0',
        '--block-time', '1',
        '--silent',
      ],
      'anvil',
      '\x1b[32m',
    )
    processes.push(anvil)
  }
})

// Start vitest in watch mode for core (the most active package during development)
console.log('\x1b[35m[dev]\x1b[0m Starting test watcher for @txfence/core...')
const testWatcher = spawnProcess(
  'pnpm',
  ['--filter', '@txfence/core', 'test:watch'],
  'tests',
  '\x1b[35m',
)
processes.push(testWatcher)

console.log('\n\x1b[36m[dev]\x1b[0m Development environment ready.')
console.log('\x1b[36m[dev]\x1b[0m Press Ctrl+C to stop.\n')

// Keep the process alive
setInterval(() => {}, 60000)
