#!/usr/bin/env node
import { resolve } from 'path'
import { loadConfig } from './config.js'
import { startServer } from './server.js'

const configArgIndex = process.argv.indexOf('--config')
const configArg = configArgIndex !== -1 ? process.argv[configArgIndex + 1] : undefined
const configPath = resolve(configArg ?? './txfence.config.ts')

try {
  const config = await loadConfig(configPath)
  await startServer(config)
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
