#!/usr/bin/env node

import { Command } from 'commander'
import { makeSimulateCommand } from './commands/simulate.js'
import { makeCheckPolicyCommand } from './commands/check-policy.js'
import { makeSubmitCommand } from './commands/submit.js'
import { makeReceiptCommand } from './commands/receipt.js'
import { makeInitCommand } from './commands/init.js'
import { makeDiffCommand } from './commands/diff.js'
import { makeDryRunCommand } from './commands/dry-run.js'
import { makePolicySnapshotCommand } from './commands/policy-snapshot.js'
import { makeIntentCommand } from './commands/intent.js'

const program = new Command()
  .name('txfence')
  .description('txfence CLI — policy checking, simulation, and execution for on-chain agents')
  .version('0.0.1')

program.addCommand(makeSimulateCommand())
program.addCommand(makeCheckPolicyCommand())
program.addCommand(makeSubmitCommand())
program.addCommand(makeReceiptCommand())
program.addCommand(makeInitCommand())
program.addCommand(makeDiffCommand())
program.addCommand(makeDryRunCommand())
program.addCommand(makePolicySnapshotCommand())
program.addCommand(makeIntentCommand())

program.parse(process.argv)
