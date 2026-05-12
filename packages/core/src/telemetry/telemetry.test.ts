import { describe, it, expect } from 'vitest'
import { noopTelemetry } from './noop.js'
import { runPipeline } from '../agent/pipeline.js'
import type { TelemetryProvider, Span } from './types.js'
import type { Policy } from '../types/policy.js'
import type { TransferAction } from '../types/action.js'

// ── noopTelemetry ─────────────────────────────────────────────────────────────

describe('noopTelemetry', () => {
  it('startSpan returns a span with working no-op methods', () => {
    const span = noopTelemetry.startSpan('test')
    expect(() => span.setAttribute('key', 'value')).not.toThrow()
    expect(() => span.setStatus('ok')).not.toThrow()
    expect(() => span.end()).not.toThrow()
  })

  it('startSpan with attributes does not throw', () => {
    expect(() => noopTelemetry.startSpan('test', {
      'string': 'value',
      'number': 42,
      'boolean': true,
    })).not.toThrow()
  })
})

// ── TelemetryProvider — pipeline integration ──────────────────────────────────

function makeMockTelemetry(): {
  provider: TelemetryProvider
  spans: Array<{ name: string; attributes: Record<string, string | number | boolean>; ended: boolean }>
} {
  const spans: Array<{
    name: string
    attributes: Record<string, string | number | boolean>
    ended: boolean
  }> = []

  const provider: TelemetryProvider = {
    startSpan: (name, attributes = {}) => {
      const span = { name, attributes: { ...attributes }, ended: false }
      spans.push(span)
      const spanRef: Span = {
        setAttribute: (key, value) => { span.attributes[key] = value },
        setStatus: (status, message) => {
          span.attributes['_status'] = status
          if (message !== undefined) span.attributes['_status_message'] = message
        },
        end: () => { span.ended = true },
      }
      return spanRef
    },
  }

  return { provider, spans }
}

const basePolicy: Policy = {
  chains: ['ethereum'],
  maxSpendPerTx: { token: 'ETH', amount: 1000000000000000000n, decimals: 18 },
  allowedContracts: [],
  requireSimulation: false,
  gasBufferMultiplier: 1.2,
  humanApprovalThreshold: { token: 'ETH', amount: 10000000000000000000n, decimals: 18 },
  humanApprovalTimeoutMs: 30000,
  capLockMode: 'per-agent',
}

const transferAction: TransferAction = {
  kind: 'transfer',
  chain: 'ethereum',
  token: { token: 'ETH', amount: 100000000000000000n, decimals: 18 },
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}

describe('TelemetryProvider — pipeline integration', () => {
  it('starts and ends a pipeline span', async () => {
    const { provider, spans } = makeMockTelemetry()
    await runPipeline(
      transferAction, basePolicy, {}, {},
      undefined, undefined, undefined, undefined,
      undefined, undefined, provider,
    )
    const pipelineSpan = spans.find(s => s.name === 'txfence.pipeline')
    expect(pipelineSpan).toBeDefined()
    expect(pipelineSpan?.ended).toBe(true)
  })

  it('records the chain and action kind on the pipeline span', async () => {
    const { provider, spans } = makeMockTelemetry()
    await runPipeline(
      transferAction, basePolicy, {}, {},
      undefined, undefined, undefined, undefined,
      undefined, undefined, provider,
    )
    const pipelineSpan = spans.find(s => s.name === 'txfence.pipeline')
    expect(pipelineSpan?.attributes['txfence.chain']).toBe('ethereum')
    expect(pipelineSpan?.attributes['txfence.action.kind']).toBe('transfer')
  })

  it('records policy_rejected status on pipeline span', async () => {
    const rejectedPolicy: Policy = {
      ...basePolicy,
      chains: ['solana'],
    }
    const { provider, spans } = makeMockTelemetry()
    await runPipeline(
      transferAction, rejectedPolicy, {}, {},
      undefined, undefined, undefined, undefined,
      undefined, undefined, provider,
    )
    const pipelineSpan = spans.find(s => s.name === 'txfence.pipeline')
    expect(pipelineSpan?.attributes['txfence.status']).toBe('policy_rejected')
    expect(pipelineSpan?.ended).toBe(true)
  })

  it('ends the pipeline span even when execution fails', async () => {
    const { provider, spans } = makeMockTelemetry()
    await runPipeline(
      transferAction, basePolicy, {}, {},
      undefined, undefined, undefined, undefined,
      undefined, undefined, provider,
    )
    const pipelineSpan = spans.find(s => s.name === 'txfence.pipeline')
    expect(pipelineSpan?.ended).toBe(true)
  })

  it('starts an eval span', async () => {
    const { provider, spans } = makeMockTelemetry()
    await runPipeline(
      transferAction, basePolicy, {}, {},
      undefined, undefined, undefined, undefined,
      undefined, undefined, provider,
    )
    const evalSpan = spans.find(s => s.name === 'txfence.policy.evaluate')
    expect(evalSpan).toBeDefined()
    expect(evalSpan?.ended).toBe(true)
  })

  it('works correctly with no telemetry provider (no regression)', async () => {
    const result = await runPipeline(
      transferAction, basePolicy, {}, {},
    )
    expect(result.status).toBe('execution_failed')
  })
})
