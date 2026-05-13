import type {
  Intent,
  ForkSimulationConfig,
  ForkSimulationResult,
  StepForkSimulationResult,
  StateChange,
  PositionChange,
  ChainId,
  SimulationResult,
} from '@txfence/core'
import { getExecutionPlan, mergePositionChanges } from '@txfence/core'
import {
  createFork,
  simulateOnFork,
  deleteFork,
  buildForkTransactionParams,
} from './fork-client.js'
import { getViemChain } from './chains.js'

export async function simulateIntentOnFork(
  intent: Intent,
  config: ForkSimulationConfig,
  chainId: ChainId,
  rpcUrl: string,
): Promise<ForkSimulationResult> {
  if (config.provider !== 'tenderly' || config.tenderlyConfig === undefined) {
    throw new Error(
      'simulateIntentOnFork requires provider: "tenderly" with tenderlyConfig. ' +
      'Solana fork simulation is planned for v2.'
    )
  }

  const tenderlyConfig = config.tenderlyConfig
  const simulatedAt = Date.now()

  let executionPlan: string[]
  try {
    executionPlan = getExecutionPlan(intent)
  } catch (err) {
    throw new Error(`Intent graph is invalid: ${(err as Error).message}`)
  }

  const stepMap = new Map(intent.steps.map(s => [s.id, s]))

  let forkId: string
  let forkedAtBlock: number

  try {
    const fork = await createFork(tenderlyConfig, chainId, config.blockNumber)
    forkId = fork.forkId
    forkedAtBlock = fork.forkedAtBlock
  } catch (err) {
    throw new Error(`Failed to create fork: ${(err as Error).message}`)
  }

  const stepResults: StepForkSimulationResult[] = []
  let cumulativePosition: PositionChange[] = []
  let wouldAllSucceed = true
  let failingStepId: string | undefined

  try {
    for (const stepId of executionPlan) {
      const step = stepMap.get(stepId)
      if (step === undefined) continue

      const txParams = buildForkTransactionParams(step.action, config.fromAddress)

      let simResult: Awaited<ReturnType<typeof simulateOnFork>>
      try {
        simResult = await simulateOnFork(
          tenderlyConfig,
          forkId,
          txParams,
          chainId,
          forkedAtBlock,
        )
      } catch (err) {
        stepResults.push({
          stepId,
          simulation: {
            success: false,
            wouldRevert: false,
            chain: chainId,
            simulatedAtBlock: forkedAtBlock,
            gasEstimate: 0n,
            gasBufferApplied: 1.0,
            coverageLevel: 'none',
            caveats: ['state_may_diverge'],
            provider: 'tenderly',
          },
          stateChanges: [],
          cumulativePosition: [...cumulativePosition],
          wouldRevert: false,
        })
        if (step.optional !== true) {
          wouldAllSucceed = false
          if (failingStepId === undefined) failingStepId = stepId
        }
        continue
      }

      const stepPositionChanges: PositionChange[] = simResult.stateChanges
        .filter(sc => sc.delta !== 0n)
        .map(sc => ({
          token: sc.token ?? 'native',
          amount: sc.delta,
          chain: chainId,
        }))

      cumulativePosition = mergePositionChanges(cumulativePosition, stepPositionChanges)

      const revertReason = simResult.revertReason
      const simulation: SimulationResult = {
        success: !simResult.wouldRevert,
        wouldRevert: simResult.wouldRevert,
        ...(revertReason !== undefined ? { revertReason } : {}),
        chain: chainId,
        simulatedAtBlock: forkedAtBlock,
        gasEstimate: BigInt(simResult.gasUsed),
        gasBufferApplied: 1.0,
        coverageLevel: 'deep',
        caveats: ['state_may_diverge'],
        provider: 'tenderly',
        trace: {
          callTrace: simResult.rawTrace,
          stateDiff: simResult.stateChanges,
          logs: [],
          gasUsed: simResult.gasUsed,
        },
      }

      stepResults.push({
        stepId,
        simulation,
        stateChanges: simResult.stateChanges,
        cumulativePosition: [...cumulativePosition],
        wouldRevert: simResult.wouldRevert,
        ...(revertReason !== undefined ? { revertReason } : {}),
      })

      if (simResult.wouldRevert && step.optional !== true) {
        wouldAllSucceed = false
        if (failingStepId === undefined) failingStepId = stepId
      }
    }
  } finally {
    await deleteFork(tenderlyConfig, forkId)
  }

  return {
    forkId,
    chain: chainId,
    forkedAtBlock,
    steps: stepResults,
    finalPosition: cumulativePosition.filter(p => p.amount !== 0n),
    wouldAllSucceed,
    ...(failingStepId !== undefined ? { failingStepId } : {}),
    simulatedAt,
  }
}
