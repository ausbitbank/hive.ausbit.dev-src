import { describe, expect, it } from 'vitest'
import Settings from '../../src/components/settings.vue'

const isHttpNodeUrl = Settings.methods.isHttpNodeUrl

describe('settings API node validation', () => {
  it('accepts absolute http(s) URLs', () => {
    expect(isHttpNodeUrl('https://api.hive.blog')).toBe(true)
    expect(isHttpNodeUrl('http://127.0.0.1:8080')).toBe(true)
    expect(isHttpNodeUrl('https://herpc.example.com/rpc')).toBe(true)
  })

  it('rejects missing schemes, bad hosts and other protocols', () => {
    expect(isHttpNodeUrl('api.hive.blog')).toBe(false)
    expect(isHttpNodeUrl('https://api.hive,blog')).toBe(false)
    expect(isHttpNodeUrl('wss://example.com')).toBe(false)
    expect(isHttpNodeUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpNodeUrl('not a url')).toBe(false)
    expect(isHttpNodeUrl('')).toBe(false)
  })
})
