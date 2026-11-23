import { describe, expect, it } from 'vitest'
import {
  addWidgetToLayout,
  availableWidgetCount,
  draftChanges,
  draftWidgets,
  isConfigurableWidget,
  isDefaultDraft,
  isDirtyDraft,
  sanitiseWidgetSettings,
  settingsFieldsFor,
  widthChoices,
  widgetCatalogue
} from '../../src/services/dashboardEditing'
import { DEFAULT_LAYOUT, LOGGED_IN_STARTER_LAYOUT, buildLayout } from '../../src/services/dashboardLayout'

function defaultLayout () {
  return buildLayout(DEFAULT_LAYOUT)
}

describe('add-widget catalogue', () => {
  it('groups the registry by category in the declared order', () => {
    const groups = widgetCatalogue(defaultLayout())
    expect(groups.map(group => group.id)).toEqual(['network', 'markets', 'governance', 'community', 'account'])
    const all = groups.flatMap(group => group.widgets)
    expect(all.length).toBeGreaterThanOrEqual(9)
    for (const entry of all) {
      expect(entry.label).toBeTruthy()
      expect(entry.description).toBeTruthy()
      expect(entry.icon).toBeTruthy()
    }
  })

  it('marks singleton widgets that are already on the dashboard as added', () => {
    const layout = defaultLayout()
    const block = widgetCatalogue(layout).flatMap(g => g.widgets).find(entry => entry.type === 'block')
    expect(block.added).toBe(true)
    expect(block.disabled).toBe(true)
    expect(block.reason).toContain('already')
  })

  it('allows repeating a non-singleton widget', () => {
    const layout = defaultLayout()
    const posts = widgetCatalogue(layout).flatMap(g => g.widgets).find(entry => entry.type === 'posts')
    expect(posts.added).toBe(true)
    expect(posts.disabled).toBe(false)
    expect(posts.reason).toBe('')
  })

  it('keeps account widgets addable for guests, with a log-in note', () => {
    const entries = widgetCatalogue(defaultLayout(), { signedIn: false }).flatMap(g => g.widgets)
    const wallet = entries.find(entry => entry.type === 'wallet')
    expect(wallet.disabled).toBe(false)
    expect(wallet.note).toMatch(/log in/i)
    expect(wallet.reason).toBe('')
    const signedInEntries = widgetCatalogue(defaultLayout(), { signedIn: true }).flatMap(g => g.widgets)
    expect(signedInEntries.find(entry => entry.type === 'wallet').note).toBe('')
  })

  it('counts the widgets that can be added right now', () => {
    const count = availableWidgetCount(defaultLayout(), { signedIn: true })
    expect(count).toBeGreaterThan(0)
    // A dashboard at the maximum has nothing to add.
    const full = buildLayout(Array.from({ length: 20 }, () => ({ type: 'market', width: 'half', settings: {} })))
    expect(availableWidgetCount(full)).toBe(0)
  })

  it('inserts after a given widget and merges default settings', () => {
    const layout = buildLayout(LOGGED_IN_STARTER_LAYOUT)
    const target = layout[0]
    const next = addWidgetToLayout(layout, 'notifications', { afterId: target.id })
    const index = next.findIndex(widget => widget.type === 'notifications')
    expect(index).toBe(1)
    expect(next[index].settings).toEqual({ limit: 5 })
    expect(next.length).toBe(layout.length + 1)
  })

  it('ignores unknown widget types', () => {
    const layout = defaultLayout()
    expect(addWidgetToLayout(layout, 'nope')).toBe(layout)
  })

  it('lists widths from the widget minimum upwards', () => {
    expect(widthChoices('block')).toEqual(['quarter', 'third', 'half', 'twoThirds', 'full'])
    expect(widthChoices('posts')).toEqual(['half', 'twoThirds', 'full'])
    expect(widthChoices('notifications')).toEqual(['third', 'half', 'twoThirds', 'full'])
    expect(widthChoices('nope')).toEqual([])
  })
})

describe('edit-mode drafts', () => {
  it('copies widgets so edits do not touch the saved layout', () => {
    const layout = defaultLayout()
    const originalWidth = layout[0].width
    const draft = draftWidgets(layout)
    draft[0].width = 'full'
    draft[0].settings.theme = 'x'
    expect(layout[0].width).toBe(originalWidth)
    expect(layout[0].settings.theme).toBeUndefined()
    expect(draft).not.toBe(layout)
  })

  it('detects a dirty draft', () => {
    const layout = defaultLayout()
    const draft = draftWidgets(layout)
    expect(isDirtyDraft(draft, layout)).toBe(false)
    draft[1].width = 'full'
    expect(isDirtyDraft(draft, layout)).toBe(true)
  })

  it('treats a reset draft as the built-in default', () => {
    const layout = defaultLayout()
    expect(isDefaultDraft(draftWidgets(layout))).toBe(true)
    const customised = draftWidgets(layout).filter(widget => widget.type !== 'posts')
    expect(isDefaultDraft(customised)).toBe(false)
  })

  it('summarises what changed for the bar', () => {
    const layout = defaultLayout()
    const draft = draftWidgets(layout)
    draft[0].width = 'full'
    draft.push({ id: 'new', type: 'network', width: 'full', settings: {} })
    const changes = draftChanges(draft, layout)
    expect(changes.added).toBe(1)
    expect(changes.resized).toBe(1)
    expect(changes.removed).toBe(0)
    expect(changes.total).toBe(2)
  })

  it('counts a reorder as a move but not as an add or remove', () => {
    const layout = defaultLayout()
    const draft = draftWidgets(layout)
    const first = draft.shift()
    draft.push(first)
    const changes = draftChanges(draft, layout)
    expect(changes.moved).toBe(1)
    expect(changes.added).toBe(0)
    expect(changes.removed).toBe(0)
    expect(changes.resized).toBe(0)
  })

  it('reports an unchanged draft as no changes', () => {
    const layout = defaultLayout()
    expect(draftChanges(draftWidgets(layout), layout).total).toBe(0)
  })
})

describe('widget settings', () => {
  it('offers fields for every configurable registry widget', () => {
    for (const type of ['block', 'market', 'witnesses', 'posts', 'wallet', 'myWitness', 'witnessHealth', 'notifications', 'operations', 'vitals', 'walletActions', 'creatorStats', 'governance', 'hbd', 'communityPulse', 'delegations', 'witnessRound', 'nodeHealth', 'hiveEngine', 'trendingTags', 'draftsQueue', 'magiNetwork', 'accountWatchlist', 'priceAlert', 'followerGrowth']) {
      expect(isConfigurableWidget(type)).toBe(true)
      expect(settingsFieldsFor(type).length).toBeGreaterThan(0)
    }
    // Network stats and the community spotlight have no per-instance settings.
    expect(isConfigurableWidget('network')).toBe(false)
    expect(settingsFieldsFor('network')).toEqual([])
    expect(isConfigurableWidget('communitySpotlight')).toBe(false)
    expect(settingsFieldsFor('communitySpotlight')).toEqual([])
  })

  it('clamps numbers and casts toggles', () => {
    const settings = sanitiseWidgetSettings('witnesses', {
      limit: 400,
      pinMine: 'yes',
      highlight: '@ausbitbank',
      showHealth: 0,
      ignored: 'x'
    })
    expect(settings).toEqual({
      limit: 20,
      pinMine: true,
      highlight: 'ausbitbank',
      showHealth: false
    })
    expect(sanitiseWidgetSettings('notifications', { limit: -3 })).toEqual({ limit: 1 })
  })

  it('keeps whitelisted feed sources and normalises tags', () => {
    expect(sanitiseWidgetSettings('posts', { source: 'hot' })).toEqual({ source: 'hot' })
    expect(sanitiseWidgetSettings('posts', { source: 'myCommunities' })).toEqual({ source: 'myCommunities' })
    expect(sanitiseWidgetSettings('posts', { source: 'nonsense' })).toEqual({})
    expect(sanitiseWidgetSettings('posts', { tag: '  #hive-dev ' })).toEqual({ tag: 'hive-dev' })
  })

  it('normalises coin ids and currency', () => {
    const settings = sanitiseWidgetSettings('market', {
      coinIds: ['HIVE', 'bitcoin', 'bitcoin', 'bad id!', ''],
      currency: 'AUD'
    })
    expect(settings).toEqual({ coinIds: ['hive', 'bitcoin'], currency: 'aud' })
    expect(sanitiseWidgetSettings('market', { currency: 'xyz' })).toEqual({})
  })

  it('strips the @ from account overrides', () => {
    expect(sanitiseWidgetSettings('wallet', { account: '@alice' })).toEqual({ account: 'alice' })
    expect(sanitiseWidgetSettings('wallet', { account: '' })).toEqual({ account: '' })
  })

  it('sanitises list and account settings', () => {
    expect(sanitiseWidgetSettings('governance', {
      watchlist: '12, 34, 34, abc, ',
      limit: 99
    })).toEqual({ watchlist: ['12', '34'], limit: 8 })
    expect(sanitiseWidgetSettings('governance', { watchlist: ['7', '8'] })).toEqual({
      watchlist: ['7', '8']
    })
    expect(sanitiseWidgetSettings('vitals', { account: '@Alice' })).toEqual({ account: 'Alice' })
  })

  it('sanitises windows and amounts', () => {
    expect(sanitiseWidgetSettings('creatorStats', {
      windowDays: 30,
      showCurationApr: 'yes',
      showTopPost: 0
    })).toEqual({ windowDays: 30, showCurationApr: true, showTopPost: false })
    expect(sanitiseWidgetSettings('creatorStats', { windowDays: 365 })).toEqual({})
    expect(sanitiseWidgetSettings('hbd', { amount: 1500.75, showProjection: true })).toEqual({
      amount: 1500.75,
      showProjection: true
    })
    expect(sanitiseWidgetSettings('hbd', { amount: -10 })).toEqual({ amount: 1 })
  })

  it('sanitises token symbol lists and delegation toggles', () => {
    expect(sanitiseWidgetSettings('hiveEngine', {
      symbols: ['hive', 'dec', 'dec', 'bad symbol!'],
      showBalances: 1,
      limit: 99
    })).toEqual({
      symbols: ['HIVE', 'DEC'],
      showBalances: true,
      limit: 8
    })
    expect(sanitiseWidgetSettings('delegations', {
      showIncoming: 'yes',
      showOutgoing: 0,
      limit: 99
    })).toEqual({
      showIncoming: true,
      showOutgoing: false,
      limit: 10
    })
  })

  it('sanitises account watchlists and price targets', () => {
    expect(sanitiseWidgetSettings('accountWatchlist', {
      accounts: ['@Alice', 'bob', 'bad name!', 'alice'],
      showBalances: 1
    })).toEqual({
      accounts: ['alice', 'bob'],
      showBalances: true
    })
    expect(sanitiseWidgetSettings('priceAlert', {
      target: -5,
      direction: 'below'
    })).toEqual({ target: 0, direction: 'below' })
    expect(sanitiseWidgetSettings('priceAlert', { direction: 'sideways' })).toEqual({})
  })

  it('keeps feed references and whitelists account feed types', () => {
    expect(sanitiseWidgetSettings('posts', { reference: ' /@ausbitbank/feed ' })).toEqual({
      reference: '/@ausbitbank/feed'
    })
    expect(sanitiseWidgetSettings('posts', { reference: '#hive-dev' })).toEqual({
      reference: '#hive-dev'
    })
    expect(sanitiseWidgetSettings('posts', { feedSort: 'feed' })).toEqual({ feedSort: 'feed' })
    expect(sanitiseWidgetSettings('posts', { feedSort: 'wallet' })).toEqual({})
  })
})
