import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SAFETY_SOURCES,
  normaliseSafetySources,
  safetySourceById,
  safetySummary
} from '../../src/services/accountSafety'

describe('account safety summary', () => {
  it('reports a clear result only when every selected list was read', () => {
    const summary = safetySummary({
      account: 'ausbitbank',
      reads: [
        { id: 'hive-blog-phishing', names: ['spammer'] },
        { id: 'plentyofphish', names: ['phisher'] }
      ]
    })
    expect(summary.level).toBe('clear')
    expect(summary.levelLabel).toBe('No warning found')
    expect(summary.checked).toBe(2)
    expect(summary.total).toBe(2)
    expect(summary.matches).toEqual([])
    expect(summary.limitation).toMatch(/never hides/)
  })

  it('reports every matching source with provenance', () => {
    const summary = safetySummary({
      account: '@ausbitbank',
      reads: [
        { id: 'hive-blog-phishing', names: ['someone', 'ausbitbank'] },
        { id: 'spaminator-blacklist', names: [{ name: 'AUSBITBANK' }] }
      ]
    })
    expect(summary.level).toBe('listed')
    expect(summary.hasWarnings).toBe(true)
    expect(summary.matches.map(match => match.id)).toEqual(['hive-blog-phishing', 'spaminator-blacklist'])
    expect(summary.matches[0]).toMatchObject({
      owner: 'hive.blog',
      asOf: '2026-11-24'
    })
    expect(summary.matches[1].title).toMatch(/Spaminator/)
  })

  it('keeps a partial result when one list fails', () => {
    const summary = safetySummary({
      account: 'ausbitbank',
      reads: [
        { id: 'hive-blog-phishing', names: ['someone'] },
        { id: 'plentyofphish', error: 'bridge timeout' }
      ]
    })
    expect(summary.level).toBe('partial')
    expect(summary.checked).toBe(1)
    expect(summary.total).toBe(2)
    expect(summary.failures).toEqual([
      { id: 'plentyofphish', title: 'Plenty of Phish source list', owner: 'plentyofphish', error: 'bridge timeout' }
    ])
  })

  it('lets a match outrank a partial failure', () => {
    const summary = safetySummary({
      account: 'ausbitbank',
      reads: [
        { id: 'hive-blog-phishing', names: ['ausbitbank'] },
        { id: 'plentyofphish', error: 'timeout' }
      ]
    })
    expect(summary.level).toBe('listed')
    expect(summary.matches).toHaveLength(1)
    expect(summary.failures).toHaveLength(1)
  })

  it('reports unknown when nothing was read', () => {
    const summary = safetySummary({ account: 'ausbitbank', reads: [] })
    expect(summary.level).toBe('unknown')
    expect(summary.checked).toBe(0)
    expect(summary.validAccount).toBe(true)
  })

  it('validates and normalises names', () => {
    expect(safetySummary({ account: 'not a name', reads: [] }).validAccount).toBe(false)
    expect(safetySummary({ account: '', reads: [] }).validAccount).toBe(false)
  })

  it('exposes the curated sources and their defaults', () => {
    expect(DEFAULT_SAFETY_SOURCES).toEqual([
      'hive-blog-phishing',
      'plentyofphish',
      'spaminator-blacklist'
    ])
    expect(safetySourceById('hive-blog-phishing').owner).toBe('hive.blog')
    expect(safetySourceById('nope')).toBeNull()
  })

  it('keeps only known source ids, in catalogue order and bounded', () => {
    expect(normaliseSafetySources(['spaminator-blacklist', 'bogus', 'hive-blog-phishing']))
      .toEqual(['hive-blog-phishing', 'spaminator-blacklist'])
    expect(normaliseSafetySources(null)).toEqual([])
  })
})
