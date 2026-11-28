import { describe, expect, it } from 'vitest'
import {
  COMMANDS,
  commandScore,
  nextSelection,
  rankCommands,
  resolveEnterAction,
  resolveJumpResults
} from '../../src/components/CommandPalette.vue'

describe('command palette navigation', () => {
  it('walks and wraps through results and the search row', () => {
    // total 3 result rows plus the "Search for …" row (index -1).
    const down = [
      [0, 1], [1, 2], [2, -1], [-1, 0]
    ]
    for (const [from, expected] of down) expect(nextSelection(from, 3, 1, true)).toBe(expected)

    const up = [
      [2, 1], [1, 0], [0, -1]
    ]
    for (const [from, expected] of up) expect(nextSelection(from, 3, -1, true)).toBe(expected)
  })

  it('wraps without a search row and handles an empty palette', () => {
    expect(nextSelection(2, 3, 1, false)).toBe(0)
    expect(nextSelection(0, 3, -1, false)).toBe(2)
    expect(nextSelection(0, 3, 1, false)).toBe(1)
    for (const direction of [-1, 1]) {
      expect(nextSelection(0, 0, direction, false)).toBe(-1)
      expect(nextSelection(0, 0, direction, true)).toBe(-1)
    }
  })

  it('does not get stuck on the search row when pressing up', () => {
    // Regression: pressing Up on the search row previously returned -1 again.
    expect(nextSelection(-1, 3, -1, true)).toBe(2)
  })
})

describe('command palette jump results', () => {
  it('offers topic destinations for a bare word, not an account jump', () => {
    const paths = resolveJumpResults('photography').map(item => item.path)
    expect(paths).toContain('/trending/photography')
    expect(paths).not.toContain('/@photography')
  })

  it('reveals an account jump once a bare word matches a real account', () => {
    const paths = resolveJumpResults('ausbitbank', { accountChecks: { ausbitbank: 'found' } }).map(item => item.path)
    expect(paths).toContain('/@ausbitbank')
    expect(paths).toContain('/@ausbitbank/wallet')
  })

  it('keeps explicit accounts, tags, blocks and URLs as direct jumps', () => {
    expect(resolveJumpResults('@alice').map(item => item.path)).toContain('/@alice')
    expect(resolveJumpResults('#photography').map(item => item.path)).toEqual(
      expect.arrayContaining(['/trending/photography', '/created/photography', '/hot/photography'])
    )
    expect(resolveJumpResults('100000000').map(item => item.path)).toEqual(['/b/100000000'])
    expect(resolveJumpResults('https://peakd.com/@alice').map(item => item.path)).toContain('/@alice')
  })

  it('offers every useful account subpage for a known account', () => {
    const paths = resolveJumpResults('@alice', { knownAccounts: { alice: {} } }).map(item => item.path)
    expect(paths).toEqual(expect.arrayContaining([
      '/@alice',
      '/@alice/wallet',
      '/@alice/transfers',
      '/@alice/posts',
      '/@alice/blog',
      '/@alice/feed',
      '/@alice/replies',
      '/@alice/comments',
      '/@alice/followers',
      '/@alice/following',
      '/@alice/communities',
      '/@alice/delegations',
      '/@alice/downvotes',
      '/@alice/tip',
      '/@alice/pos',
      '/@alice/lightning'
    ]))
  })

  it('returns nothing for empty or unrecognised input', () => {
    expect(resolveJumpResults('')).toEqual([])
    expect(resolveJumpResults('   ')).toEqual([])
  })
})

describe('command palette enter', () => {
  it('opens full search when the search row is selected', () => {
    expect(resolveEnterAction(-1, false, true)).toBe('search')
  })

  it('selects the highlighted result', () => {
    expect(resolveEnterAction(0, true, true)).toBe('select')
    expect(resolveEnterAction(2, true, false)).toBe('select')
  })

  it('falls back to full search when a result index is stale', () => {
    expect(resolveEnterAction(5, false, true)).toBe('search')
  })

  it('does nothing when there is neither a result nor a search row', () => {
    expect(resolveEnterAction(0, false, false)).toBe('none')
    expect(resolveEnterAction(-1, false, false)).toBe('none')
  })
})

describe('command palette catalog', () => {
  it('finds every page by its own name', () => {
    for (const command of COMMANDS) {
      const matches = rankCommands(COMMANDS, command.label.toLowerCase())
      expect(matches.map(item => item.path)).toContain(command.path)
    }
  })

  it('ranks label matches above description and keyword matches', () => {
    const ranked = rankCommands([
      { label: 'Something else', description: 'mentions lightning', keywords: 'zap' },
      { label: 'Lightning', description: 'pay invoices', keywords: 'zap' },
      { label: 'My lightning tips', description: 'tip', keywords: 'zap' }
    ], 'lightning')
    expect(ranked.map(command => command.label)).toEqual([
      'Lightning',
      'My lightning tips',
      'Something else'
    ])
  })

  it('matches synonym keywords so hidden pages stay discoverable', () => {
    expect(rankCommands(COMMANDS, 'dhf').map(command => command.path)).toContain('/proposals')
    expect(rankCommands(COMMANDS, 'preferences').map(command => command.path)).toContain('/appearance')
    expect(rankCommands(COMMANDS, 'microblog').map(command => command.path)).toContain('/shorts')
    expect(rankCommands(COMMANDS, 'night').map(command => command.path)).toContain('/appearance')
  })

  it('matches multi-word queries against any word order', () => {
    expect(rankCommands(COMMANDS, 'keys join').map(command => command.path)).toContain('/join/keys')
    expect(rankCommands(COMMANDS, 'stabilizer hbd').map(command => command.path)).toContain('/hbdstabilizer')
    expect(rankCommands(COMMANDS, 'wall theme').map(command => command.path)).toContain('/themes')
  })

  it('matches word prefixes, not arbitrary substrings', () => {
    const about = { label: 'About Banksia', description: 'Source and credits', keywords: 'docs license' }
    expect(commandScore(about, 'about')).toBe(0)
    expect(commandScore(about, 'cred')).toBe(2)
    expect(commandScore(about, 'in')).toBe(-1)
  })
})
