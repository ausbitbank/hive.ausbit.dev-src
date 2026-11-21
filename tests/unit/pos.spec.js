import { describe, expect, it } from 'vitest'
import {
  posAmount,
  posCurrency,
  posInvoiceMessage,
  posKeypad,
  posReceiveCurrency,
  posSessionTotals
} from '../../src/services/pos'

describe('point of sale helpers', () => {
  it('applies keypad presses with the currency precision', () => {
    expect(posKeypad('', '1', { decimals: 3 })).toBe('1')
    expect(posKeypad('1', '0', { decimals: 3 })).toBe('10')
    expect(posKeypad('0', '5', { decimals: 3 })).toBe('5')
    expect(posKeypad('0', '.', { decimals: 3 })).toBe('0.')
    expect(posKeypad('1.2', '3', { decimals: 3 })).toBe('1.23')
    expect(posKeypad('1.234', '5', { decimals: 3 })).toBe('1.234')
    expect(posKeypad('10', '.', { decimals: 0 })).toBe('10')
    expect(posKeypad('12', 'backspace', { decimals: 3 })).toBe('1')
    expect(posKeypad('12', 'clear', { decimals: 3 })).toBe('')
    expect(posKeypad('1.2', '.', { decimals: 3 })).toBe('1.2')
  })

  it('parses positive amounts only', () => {
    expect(posAmount('12.5')).toBe(12.5)
    expect(posAmount('0')).toBe(0)
    expect(posAmount('')).toBe(0)
    expect(posAmount('nope')).toBe(0)
  })

  it('sanitises the public invoice message', () => {
    expect(posInvoiceMessage('Coffee | table 4')).toBe('Coffee / table 4 · POS via hive.ausbit.dev')
    expect(posInvoiceMessage('  ')).toBe('POS via hive.ausbit.dev')
    expect(posInvoiceMessage('x'.repeat(400))).toHaveLength(246)
  })

  it('picks the receive asset and currency defaults', () => {
    expect(posReceiveCurrency('hive')).toBe('hive')
    expect(posReceiveCurrency('hbd')).toBe('hbd')
    expect(posReceiveCurrency('sats')).toBe('hbd')
    expect(posReceiveCurrency('sats', 'HIVE')).toBe('hive')
    expect(posCurrency('sats')).toMatchObject({ decimals: 0 })
    expect(posCurrency('usd')).toMatchObject({ decimals: 2 })
    expect(posCurrency('nope')).toMatchObject({ value: 'sats' })
  })

  it('totals only the local session', () => {
    expect(posSessionTotals()).toEqual({ count: 0, sats: 0 })
    expect(posSessionTotals([
      { sats: 1000 },
      { sats: '2345' },
      { sats: null }
    ])).toEqual({ count: 3, sats: 3345 })
  })
})
