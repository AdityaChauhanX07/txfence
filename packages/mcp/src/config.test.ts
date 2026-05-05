import { describe, it, expect } from 'vitest'
import { env, envOptional } from './config.js'

describe('env helper', () => {
  it('returns the value when the env var is set', () => {
    process.env['TEST_VAR'] = 'hello'
    expect(env('TEST_VAR')).toBe('hello')
    delete process.env['TEST_VAR']
  })

  it('throws when the env var is not set', () => {
    delete process.env['MISSING_VAR']
    expect(() => env('MISSING_VAR')).toThrow('MISSING_VAR')
  })

  it('throws when the env var is empty string', () => {
    process.env['EMPTY_VAR'] = ''
    expect(() => env('EMPTY_VAR')).toThrow()
    delete process.env['EMPTY_VAR']
  })
})

describe('envOptional helper', () => {
  it('returns the value when set', () => {
    process.env['OPT_VAR'] = 'world'
    expect(envOptional('OPT_VAR')).toBe('world')
    delete process.env['OPT_VAR']
  })

  it('returns undefined when not set', () => {
    delete process.env['OPT_MISSING']
    expect(envOptional('OPT_MISSING')).toBeUndefined()
  })
})
