import type { BoundAction } from '../types/action.js'
import type { SimulationResult } from '../types/simulation.js'
import type { PolicyEvaluation } from '../types/receipt.js'
import {
  checkChain,
  checkContract,
  checkSpend,
  checkSlippage,
  checkSimulationRequired,
  checkGasBuffer,
} from './checks.js'

export function evaluate(
  action: BoundAction,
  simulationResult?: SimulationResult,
): PolicyEvaluation {
  const results = [
    checkChain(action),
    checkContract(action),
    checkSpend(action),
    checkSlippage(action),
    checkSimulationRequired(action, simulationResult),
    checkGasBuffer(action, simulationResult),
  ]

  const checksRun = results.map(r => r.name)
  const firstFailing = results.find(r => !r.passed)

  if (firstFailing === undefined) {
    return { passed: true, checksRun }
  }

  if (firstFailing.reason !== undefined) {
    return { passed: false, checksRun, rejectionReason: firstFailing.reason }
  }

  return { passed: false, checksRun }
}
