import { describe, expect, it } from 'vitest'
import {
  hiveEngineJson,
  hiveEngineOperation,
  isValidOrderQuantity,
  isValidOrderTotal,
  nextRequestId,
  parseAssetAmount
} from '../../src/services/signingInputs'

describe('signing amount input', () => {
  it('formats a valid positive amount to the asset precision', () => {
    expect(parseAssetAmount('1.5')).toBe('1.500')
    expect(parseAssetAmount(2, { precision: 0 })).toBe('2')
    expect(parseAssetAmount('0.001', { precision: 3 })).toBe('0.001')
  })

  it('rejects empty, NaN, negative, zero and comma forms', () => {
    for (const value of ['', 'abc', '-1', '0', '1,5', '1,000', '+1', '1e3', null, undefined]) {
      expect(parseAssetAmount(value), String(value)).toBeNull()
    }
  })

  it('rounds down so a max amount cannot exceed the balance', () => {
    expect(parseAssetAmount('1.2349', { precision: 3 })).toBe('1.234')
    expect(parseAssetAmount('0.0009', { precision: 3 })).toBeNull()
  })

  it('rejects amounts above an explicit maximum', () => {
    expect(parseAssetAmount('5.001', { max: '5.000' })).toBeNull()
    expect(parseAssetAmount('5', { max: 5 })).toBe('5.000')
  })
})

describe('signing request ids', () => {
  it('returns a positive uint32-safe id and does not repeat in one second', () => {
    const ids = [1, 2, 3].map(() => nextRequestId(1_700_000_000_000))
    for (const id of ids) {
      expect(Number.isInteger(id)).toBe(true)
      expect(id).toBeGreaterThan(0)
      expect(id).toBeLessThan(2 ** 32)
    }
    expect(new Set(ids).size).toBe(3)
  })
})

describe('Hive-Engine order guards', () => {
  it('caps sell quantity and buy total at the available balance', () => {
    expect(isValidOrderQuantity(5, 5)).toBe(true)
    expect(isValidOrderQuantity(5.001, 5)).toBe(false)
    expect(isValidOrderQuantity(0, 5)).toBe(false)
    expect(isValidOrderTotal(0.5, 10, 5)).toBe(true)
    expect(isValidOrderTotal(0.5, 10.1, 5)).toBe(false)
    expect(isValidOrderTotal(0, 10, 5)).toBe(false)
    expect(isValidOrderTotal(0.5, 10, null)).toBe(false)
  })
})

describe('Hive-Engine write payloads', () => {
  it('serialises a normal transfer', () => {
    const json = hiveEngineJson('tokens', 'transfer', {
      symbol: 'PAL',
      to: 'bob',
      quantity: '1.000',
      memo: 'thanks'
    })
    expect(JSON.parse(json)).toEqual({
      contractName: 'tokens',
      contractAction: 'transfer',
      contractPayload: { symbol: 'PAL', to: 'bob', quantity: '1.000', memo: 'thanks' }
    })
  })

  it('cannot let a memo inject a second recipient or quantity', () => {
    const memo = 'x", "to": "attacker", "quantity": "999.000'
    const operation = hiveEngineOperation('alice', 'tokens', 'transfer', {
      symbol: 'PAL',
      to: 'bob',
      quantity: '1.000',
      memo
    })

    expect(operation[0]).toBe('custom_json')
    expect(operation[1].id).toBe('ssc-mainnet-hive')
    expect(operation[1].required_auths).toEqual(['alice'])
    expect(operation[1].required_posting_auths).toEqual([])

    const payload = JSON.parse(operation[1].json)
    expect(payload.contractPayload.to).toBe('bob')
    expect(payload.contractPayload.quantity).toBe('1.000')
    expect(payload.contractPayload.memo).toBe(memo)
  })

  it('handles backslashes, newlines and quotes without breaking the JSON', () => {
    const memo = 'line1\nline2 \\ "quoted"'
    const payload = JSON.parse(hiveEngineJson('tokens', 'transfer', { memo }))
    expect(payload.contractPayload.memo).toBe(memo)
  })

  it('keeps market command fields as strings', () => {
    const payload = JSON.parse(hiveEngineJson('market', 'buy', { symbol: 'PAL', quantity: 1, price: 0.5 }))
    expect(payload.contractPayload).toEqual({ symbol: 'PAL', quantity: 1, price: 0.5 })
  })
})
