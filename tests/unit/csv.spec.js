import { describe, expect, it } from 'vitest'
import { csvCell } from '../../src/utils/csv'

describe('csvCell', () => {
  it('quotes plain values by default', () => {
    expect(csvCell('lightning')).toBe('"lightning"')
    expect(csvCell(42)).toBe('"42"')
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
  })

  it('escapes embedded quotes and keeps delimiters inside one cell', () => {
    expect(csvCell('a "quoted" value')).toBe('"a ""quoted"" value"')
    expect(csvCell('one,two')).toBe('"one,two"')
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
  })

  it('neutralises spreadsheet formula leaders', () => {
    for (const value of ['=1+1', '+SUM(A1)', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd']) {
      expect(csvCell(value), value).toBe(`"'${value}"`)
    }
  })

  it('can preserve the minimal-quote wallet shape', () => {
    expect(csvCell('plain', { quote: false })).toBe('plain')
    expect(csvCell('a,b', { quote: false })).toBe('"a,b"')
    expect(csvCell('say "hi"', { quote: false })).toBe('"say ""hi"""')
    expect(csvCell('=cmd', { quote: false })).toBe("'=cmd")
  })
})
