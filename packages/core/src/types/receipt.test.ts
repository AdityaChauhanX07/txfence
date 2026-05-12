import { describe, it, expect } from 'vitest'
import { formatExecutionFailureReason } from './receipt.js'

describe('formatExecutionFailureReason', () => {
  it('formats no_executor', () => {
    expect(formatExecutionFailureReason({ code: 'no_executor' }))
      .toContain('No executor')
  })

  it('formats executor_threw with message', () => {
    expect(formatExecutionFailureReason({ code: 'executor_threw', message: 'timeout' }))
      .toContain('timeout')
  })

  it('formats signing_failed with message', () => {
    expect(formatExecutionFailureReason({ code: 'signing_failed', message: 'key not found' }))
      .toContain('key not found')
  })

  it('formats broadcast_failed with txHash', () => {
    const output = formatExecutionFailureReason({
      code: 'broadcast_failed', message: 'node error', txHash: '0xabc',
    })
    expect(output).toContain('0xabc')
    expect(output).toContain('node error')
  })

  it('formats broadcast_failed without txHash — no undefined in output', () => {
    const output = formatExecutionFailureReason({
      code: 'broadcast_failed', message: 'node error',
    })
    expect(output).not.toContain('undefined')
    expect(output).toContain('node error')
  })
})
