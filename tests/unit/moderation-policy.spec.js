import { describe, expect, it } from 'vitest'
import * as contentModule from '../../src/services/moderationContent'
import {
  decideSkin,
  displayedReputation,
  normalizeName,
  normalizeViewerContext,
  SKIN_DECISION
} from '../../src/services/moderationPolicy'

function viewer (overrides = {}) {
  return {
    status: 'ready',
    muted: [],
    following: [],
    followedMuteLists: [],
    showAuthors: [],
    hideAuthors: [],
    listErrors: 0,
    ...overrides
  }
}

describe('displayedReputation', () => {
  it('distinguishes unknown, zero and raw chain values', () => {
    expect(displayedReputation(null)).toBeNull()
    expect(displayedReputation(undefined)).toBeNull()
    expect(displayedReputation('')).toBeNull()
    expect(displayedReputation('nope')).toBeNull()
    expect(displayedReputation(0)).toBe(25)
    expect(displayedReputation('0')).toBe(25)
    expect(displayedReputation(295634214098804)).toBe(74)
    expect(displayedReputation(-1073543807079)).toBeLessThan(0)
  })

  it('accepts an already-displayed score', () => {
    expect(displayedReputation(73.44)).toBe(73.44)
    expect(displayedReputation(-3.5)).toBe(-3.5)
  })
})

describe('normalizeName', () => {
  it('strips at-signs, case and whitespace and caps at 16 characters', () => {
    expect(normalizeName('  @Alice  ')).toBe('alice')
    expect(normalizeName('a'.repeat(40))).toHaveLength(16)
    expect(normalizeName(null)).toBe('')
  })
})

describe('decideSkin', () => {
  it('allows a clean author', () => {
    const result = decideSkin({ author: 'alice', reputation: 60, viewer: viewer() })
    expect(result.allowed).toBe(true)
    expect(result.code).toBe(SKIN_DECISION.ALLOWED)
    expect(result.label).toBe('')
  })

  it('normalizes the author before decisions', () => {
    const result = decideSkin({
      author: '@Alice',
      reputation: 60,
      viewer: viewer({ muted: ['alice'] })
    })
    expect(result.allowed).toBe(false)
    expect(result.code).toBe(SKIN_DECISION.PERSONAL_MUTE)
    expect(result.author).toBe('alice')
  })

  it('blocks a directly muted author', () => {
    const result = decideSkin({ author: 'alice', reputation: 60, viewer: viewer({ muted: ['alice'] }) })
    expect(result.allowed).toBe(false)
    expect(result.code).toBe(SKIN_DECISION.PERSONAL_MUTE)
    expect(result.label).toContain('you mute @alice')
  })

  it('blocks negative reputation', () => {
    const result = decideSkin({ author: 'alice', reputation: -500, viewer: viewer() })
    expect(result.allowed).toBe(false)
    expect(result.code).toBe(SKIN_DECISION.NEGATIVE_REPUTATION)
  })

  it('blocks an unknown reputation when the reputation rule is on', () => {
    const result = decideSkin({ author: 'alice', reputation: null, viewer: viewer() })
    expect(result.allowed).toBe(false)
    expect(result.code).toBe(SKIN_DECISION.REPUTATION_UNAVAILABLE)
  })

  it('allows raw zero because raw zero displays as 25', () => {
    const result = decideSkin({ author: 'alice', reputation: 0, viewer: viewer() })
    expect(result.allowed).toBe(true)
  })

  it('fails closed while the viewer context is unresolved', () => {
    for (const status of ['idle', 'loading', 'error']) {
      const result = decideSkin({ author: 'alice', reputation: 60, viewer: viewer({ status }) })
      expect(result.allowed).toBe(false)
      expect(result.code).toBe(SKIN_DECISION.CONTEXT_UNAVAILABLE)
    }
  })

  it('blocks a followed mute-list member', () => {
    const result = decideSkin({
      author: 'alice',
      reputation: 60,
      viewer: viewer({
        followedMuteLists: [{ owner: 'hive.blog', members: ['alice'] }]
      })
    })
    expect(result.allowed).toBe(false)
    expect(result.code).toBe(SKIN_DECISION.FOLLOWED_MUTE_LIST)
    expect(result.owners).toEqual(['hive.blog'])
    expect(result.label).toContain('@hive.blog')
  })

  it('lets a follow beat a subscribed mute list by default', () => {
    const result = decideSkin({
      author: 'alice',
      reputation: 60,
      viewer: viewer({
        following: ['alice'],
        followedMuteLists: [{ owner: 'hive.blog', members: ['alice'] }]
      })
    })
    expect(result.allowed).toBe(true)
    expect(result.code).toBe(SKIN_DECISION.FOLLOWED_OVERRIDE)
    expect(result.conflict).toEqual({ kind: 'follow-vs-mutelist', owners: ['hive.blog'] })
  })

  it('lets a follow beat a mute list only when the setting allows it', () => {
    const result = decideSkin({
      author: 'alice',
      reputation: 60,
      viewer: viewer({
        following: ['alice'],
        followedMuteLists: [{ owner: 'hive.blog', members: ['alice'] }]
      }),
      settings: { followedMuteListOverride: false }
    })
    expect(result.allowed).toBe(false)
    expect(result.code).toBe(SKIN_DECISION.FOLLOWED_MUTE_LIST)
  })

  it('does not let a follow beat a direct mute', () => {
    const result = decideSkin({
      author: 'alice',
      reputation: 60,
      viewer: viewer({ muted: ['alice'], following: ['alice'] })
    })
    expect(result.allowed).toBe(false)
    expect(result.code).toBe(SKIN_DECISION.PERSONAL_MUTE)
  })

  it('keeps a negative-reputation skin blocked for a followed author by default', () => {
    const result = decideSkin({
      author: 'alice',
      reputation: -500,
      viewer: viewer({ following: ['alice'] })
    })
    expect(result.allowed).toBe(false)
    expect(result.code).toBe(SKIN_DECISION.NEGATIVE_REPUTATION)
  })

  it('lets an explicit followed-reputation override lift the block', () => {
    const result = decideSkin({
      author: 'alice',
      reputation: -500,
      viewer: viewer({ following: ['alice'] }),
      settings: { followedReputationOverride: true }
    })
    expect(result.allowed).toBe(true)
    expect(result.code).toBe(SKIN_DECISION.FOLLOWED_OVERRIDE)
  })

  it('honours an explicit show override above mute and reputation', () => {
    const result = decideSkin({
      author: 'alice',
      reputation: -500,
      viewer: viewer({ muted: ['alice'], showAuthors: ['alice'] })
    })
    expect(result.allowed).toBe(true)
    expect(result.code).toBe(SKIN_DECISION.VIEWER_SHOW)
  })

  it('honours an explicit hide override above a show override', () => {
    const result = decideSkin({
      author: 'alice',
      reputation: 60,
      viewer: viewer({ showAuthors: ['alice'], hideAuthors: ['alice'] })
    })
    expect(result.allowed).toBe(false)
    expect(result.code).toBe(SKIN_DECISION.VIEWER_HIDE)
  })

  it('blocks when a subscribed list could not be read and the author is not followed', () => {
    const result = decideSkin({
      author: 'alice',
      reputation: 60,
      viewer: viewer({ listErrors: 1 })
    })
    expect(result.allowed).toBe(false)
    expect(result.code).toBe(SKIN_DECISION.CONTEXT_UNAVAILABLE)
    expect(result.detail).toContain('One mute list')
  })

  it('allows a followed author when an unresolved list cannot be proven either way', () => {
    const result = decideSkin({
      author: 'alice',
      reputation: 60,
      viewer: viewer({ listErrors: 1, following: ['alice'] })
    })
    expect(result.allowed).toBe(true)
    expect(result.code).toBe(SKIN_DECISION.FOLLOWED_OVERRIDE)
  })

  it('can be configured to ignore mute and reputation rules', () => {
    const muted = decideSkin({
      author: 'alice',
      reputation: 60,
      viewer: viewer({ muted: ['alice'] }),
      settings: { blockMuted: false }
    })
    expect(muted.allowed).toBe(true)

    const negative = decideSkin({
      author: 'alice',
      reputation: -500,
      viewer: viewer(),
      settings: { blockNegativeReputation: false }
    })
    expect(negative.allowed).toBe(true)
  })

  it('blocks an author that cannot be identified', () => {
    const result = decideSkin({ author: '', reputation: 60, viewer: viewer() })
    expect(result.allowed).toBe(false)
    expect(result.code).toBe(SKIN_DECISION.AUTHOR_UNAVAILABLE)
  })

  it('does not mutate the viewer input', () => {
    const viewerValue = viewer({ muted: ['alice'], following: ['bob'] })
    decideSkin({ author: 'alice', reputation: 60, viewer: viewerValue })
    expect(viewerValue).toEqual(viewer({ muted: ['alice'], following: ['bob'] }))
  })
})

describe('normalizeViewerContext', () => {
  it('normalizes names, list owners and status', () => {
    const result = normalizeViewerContext({
      status: 'ready',
      muted: ['@Alice', 'alice', ''],
      following: ['Bob'],
      followedMuteLists: [{ owner: '@hive.blog', members: ['@Alice', 'alice'] }],
      showAuthors: ['@Carol'],
      hideAuthors: 'nope',
      listErrors: -2
    })
    expect(result.muted).toEqual(['alice'])
    expect(result.following).toEqual(['bob'])
    expect(result.followedMuteLists).toEqual([{ owner: 'hive.blog', members: ['alice'] }])
    expect(result.showAuthors).toEqual(['carol'])
    expect(result.hideAuthors).toEqual([])
    expect(result.listErrors).toBe(0)
  })

  it('defaults an unknown status to idle', () => {
    expect(normalizeViewerContext({ status: 'weird' }).status).toBe('idle')
  })
})

describe('decideContent', () => {
  const { decideContent, CONTENT_LAYER } = contentModule

  function contentViewer (overrides = {}) {
    return {
      status: 'ready',
      muted: [],
      blacklisted: [],
      following: [],
      followedMuteLists: [],
      followedBlacklistLists: [],
      showAuthors: [],
      hideAuthors: [],
      showItems: [],
      hideItems: [],
      listErrors: 0,
      ...overrides
    }
  }

  function decide (overrides = {}) {
    return decideContent({
      surface: 'feed',
      author: 'alice',
      reputation: 60,
      post: { author_reputation: 60, stats: {} },
      viewer: contentViewer(),
      preset: 'balanced',
      ...overrides
    })
  }

  it('collapses a directly muted author in Balanced', () => {
    const decision = decide({ viewer: contentViewer({ muted: ['alice'] }) })
    expect(decision.display).toBe('collapse')
    expect(decision.visible).toBe(true)
    expect(decision.primary.layer).toBe(CONTENT_LAYER.PERSONAL_MUTE)
  })

  it('labels a direct mute in Open instead of hiding it', () => {
    const decision = decide({ preset: 'open', viewer: contentViewer({ muted: ['alice'] }) })
    expect(decision.display).toBe('label')
  })

  it('keeps a blacklist as a warning label, not a mute', () => {
    const decision = decide({ viewer: contentViewer({ blacklisted: ['alice'] }) })
    expect(decision.display).toBe('label')
    expect(decision.primary.layer).toBe(CONTENT_LAYER.PERSONAL_BLACKLIST)
  })

  it('shows a followed author on a subscribed mute list with a conflict', () => {
    const decision = decide({
      viewer: contentViewer({
        following: ['alice'],
        followedMuteLists: [{ owner: 'hive.blog', members: ['alice'] }]
      })
    })
    expect(decision.display).toBe('show')
    expect(decision.conflict).toEqual({ kind: 'follow-vs-mutelist', owners: ['hive.blog'] })
  })

  it('shows every subscribed list in a follow conflict', () => {
    const decision = decide({
      viewer: contentViewer({
        following: ['alice'],
        followedMuteLists: [
          { owner: 'hive.blog', members: ['alice'] },
          { owner: 'watchlist', members: ['alice'] }
        ]
      })
    })
    expect(decision.conflict.owners).toEqual(['hive.blog', 'watchlist'])
    expect(decision.reasons.some(reason => reason.evidence?.owners?.length === 2)).toBe(true)
  })

  it('lets a list win when the viewer opts in', () => {
    const decision = decide({
      listsOverrideFollows: true,
      viewer: contentViewer({
        following: ['alice'],
        followedMuteLists: [{ owner: 'hive.blog', members: ['alice'] }]
      })
    })
    expect(decision.display).toBe('collapse')
  })

  it('never collapses a deliberate profile or post visit', () => {
    for (const surface of ['profile', 'post']) {
      const decision = decide({
        surface,
        viewer: contentViewer({ muted: ['alice'] }),
        post: { author_reputation: -500, stats: { hide: true } }
      })
      expect(decision.display).toBe('label')
    }
  })

  it('collapses rather than removes a comment', () => {
    const decision = decide({
      surface: 'comment',
      viewer: contentViewer({ showAuthors: ['alice'], hideAuthors: ['alice'] })
    })
    expect(decision.display).toBe('collapse')
  })

  it('maps muted reasons to a specific layer', () => {
    const reputation = decide({ post: { author_reputation: 60, stats: { muted_reasons: [3] } } })
    expect(reputation.reasons.some(reason => reason.layer === CONTENT_LAYER.REPUTATION)).toBe(true)
    expect(reputation.primary.label).toBe('Low reputation')

    const community = decide({ post: { author_reputation: 60, stats: { muted_reasons: [0] } } })
    expect(community.reasons.some(reason => reason.layer === CONTENT_LAYER.COMMUNITY_POST_MUTE)).toBe(true)
  })

  it('labels negative reputation but never hides on it alone', () => {
    const balanced = decide({ reputation: -500, post: { author_reputation: -500, stats: {} } })
    expect(balanced.display).toBe('collapse')
    const open = decide({ preset: 'open', reputation: -500, post: { author_reputation: -500, stats: {} } })
    expect(open.display).toBe('label')
    const strict = decide({ preset: 'strict', reputation: -500, post: { author_reputation: -500, stats: {} } })
    expect(strict.display).toBe('collapse')
  })

  it('labels downvotes and allows equipment-specific evidence later', () => {
    const decision = decide({ post: { author_reputation: 60, net_rshares: -10, stats: {} } })
    expect(decision.display).toBe('label')
    expect(decision.primary.layer).toBe(CONTENT_LAYER.DOWNVOTES)
    expect(decision.overrides).toContain('ignore-voter')
  })

  it('collapses NSFW in Balanced and labels it in Follow-only', () => {
    expect(decide({ post: { author_reputation: 60, nsfw: true, stats: {} } }).display).toBe('collapse')
    expect(decide({
      preset: 'follow-only',
      post: { author_reputation: 60, nsfw: true, stats: {} },
      viewer: contentViewer({ following: ['alice'] })
    }).display).toBe('label')
  })

  it('collapses non-followed content in Follow-only but not on a deliberate visit', () => {
    expect(decide({ preset: 'follow-only' }).display).toBe('collapse')
    expect(decide({ preset: 'follow-only', surface: 'post' }).display).toBe('show')
  })

  it('honours item and author overrides', () => {
    const key = 'alice/a-long-permlink-that-exceeds-a-hive-username'
    const shown = decide({
      itemKey: key,
      viewer: contentViewer({ muted: ['alice'], showItems: [key] })
    })
    expect(shown.display).toBe('show')
    const hidden = decide({
      itemKey: key,
      viewer: contentViewer({ showItems: [key], hideItems: [key] })
    })
    expect(hidden.display).toBe('hide')
  })

  it('uses custom per-surface rules', () => {
    const custom = JSON.parse(JSON.stringify(contentModule.DEFAULT_CONTENT_CUSTOM))
    custom.feed.mute = 'label'
    const decision = decide({
      preset: 'custom',
      custom,
      viewer: contentViewer({ muted: ['alice'] })
    })
    expect(decision.display).toBe('label')
  })

  it('fails open with an explanation when the viewer context is unavailable', () => {
    const decision = decide({
      viewer: contentViewer({ status: 'error', muted: ['alice'] })
    })
    expect(decision.unknownContext).toBe(true)
    expect(decision.reasons.some(reason => reason.layer === CONTENT_LAYER.CONTEXT_UNAVAILABLE)).toBe(true)
    expect(decision.display).toBe('collapse')
  })

  it('does not mutate the viewer input', () => {
    const viewerValue = contentViewer({ muted: ['alice'], following: ['bob'] })
    decide({ viewer: viewerValue })
    expect(viewerValue).toEqual(contentViewer({ muted: ['alice'], following: ['bob'] }))
  })
})
