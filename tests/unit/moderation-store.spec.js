import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  fetchViewerModerationContext: vi.fn()
}))

vi.mock('../../src/services/moderationData', () => ({
  fetchViewerModerationContext: mocks.fetchViewerModerationContext
}))

const { useModerationStore } = await import('../../src/stores/moderation')
const { moderationStorageKey } = await import('../../src/services/moderationSettings')

function context (overrides = {}) {
  return {
    status: 'ready',
    muted: [],
    blacklisted: [],
    following: [],
    followedMuteOwners: [],
    followedBlacklistOwners: [],
    followedMuteLists: [],
    listErrors: 0,
    loadedAt: Date.now(),
    ...overrides
  }
}

function freshStore (scope = 'guest') {
  setActivePinia(createPinia())
  const store = useModerationStore()
  store.hydrate(scope)
  return store
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  mocks.fetchViewerModerationContext.mockReset()
  mocks.fetchViewerModerationContext.mockResolvedValue(context())
})

describe('moderation store context', () => {
  it('is ready for guests without a network call', async () => {
    const store = freshStore('guest')
    await store.ensureContext()
    expect(store.context.status).toBe('ready')
    expect(mocks.fetchViewerModerationContext).not.toHaveBeenCalled()
    expect(store.decisionForSkin({ author: 'alice', reputation: 60 }).allowed).toBe(true)
  })

  it('loads the signed-in viewer context and fails closed while loading', async () => {
    const store = freshStore('alice')
    expect(store.context.status).toBe('idle')
    expect(store.decisionForSkin({ author: 'bob', reputation: 60 }).allowed).toBe(false)

    const pending = store.ensureContext()
    expect(store.context.status).toBe('loading')
    await pending
    expect(store.context.status).toBe('ready')
    expect(mocks.fetchViewerModerationContext).toHaveBeenCalledWith('alice', { force: false })
  })

  it('blocks a muted author and lets a local show override lift it', async () => {
    mocks.fetchViewerModerationContext.mockResolvedValue(context({ muted: ['alice'] }))
    const store = freshStore('viewer')
    await store.ensureContext()

    expect(store.decisionForSkin({ author: 'alice', reputation: 60 }).code).toBe('personal-mute')
    expect(store.showSkinAuthor('@Alice')).toBe(true)
    const decision = store.decisionForSkin({ author: 'alice', reputation: 60 })
    expect(decision.allowed).toBe(true)
    expect(decision.code).toBe('viewer-show')

    const stored = JSON.parse(localStorage.getItem(moderationStorageKey('viewer')) || '{}')
    expect(stored.overrides.showAuthors).toEqual(['alice'])
  })

  it('persists an explicit hide and lets the user clear it', async () => {
    const store = freshStore('viewer')
    await store.ensureContext()

    store.hideSkinAuthor('alice')
    expect(store.decisionForSkin({ author: 'alice', reputation: 60 }).code).toBe('viewer-hide')
    store.showSkinAuthor('alice')
    expect(store.decisionForSkin({ author: 'alice', reputation: 60 }).code).toBe('viewer-show')
    store.clearSkinOverride('alice')
    expect(store.decisionForSkin({ author: 'alice', reputation: 60 }).allowed).toBe(true)
  })

  it('fails closed when the viewer context cannot be loaded', async () => {
    mocks.fetchViewerModerationContext.mockRejectedValue(new Error('node down'))
    const store = freshStore('viewer')
    await store.ensureContext()

    expect(store.context.status).toBe('error')
    const decision = store.decisionForSkin({ author: 'alice', reputation: 60 })
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('context-unavailable')
  })

  it('restores a recent session snapshot without waiting for the network', async () => {
    mocks.fetchViewerModerationContext.mockResolvedValue(context({
      muted: ['alice'],
      following: ['bob'],
      followedMuteLists: [{ owner: 'hive.blog', members: ['alice'] }]
    }))
    const first = freshStore('viewer')
    await first.ensureContext()

    const restored = freshStore('viewer')
    expect(restored.context.status).toBe('ready')
    expect(restored.context.muted).toEqual(['alice'])
    expect(restored.context.following).toEqual(['bob'])
    expect(restored.context.followedMuteLists).toEqual([
      { owner: 'hive.blog', members: ['alice'] }
    ])
  })

  it('keeps viewer contexts separate when the account changes', async () => {
    mocks.fetchViewerModerationContext.mockResolvedValue(context({ muted: ['alice'] }))
    const store = freshStore('alice')
    await store.ensureContext()
    expect(store.decisionForSkin({ author: 'bob', reputation: 60 }).allowed).toBe(true)

    store.setScope('bob')
    expect(store.scope).toBe('bob')
    expect(store.context.muted).toEqual([])
    expect(store.context.status).toBe('idle')
    expect(store.decisionForSkin({ author: 'bob', reputation: 60 }).allowed).toBe(false)
  })

  it('updates mute and follow state immediately', async () => {
    const store = freshStore('viewer')
    await store.ensureContext()

    store.noteMuteChange('alice', true)
    expect(store.decisionForSkin({ author: 'alice', reputation: 60 }).code).toBe('personal-mute')
    store.noteMuteChange('alice', false)
    expect(store.decisionForSkin({ author: 'alice', reputation: 60 }).allowed).toBe(true)

    store.context = {
      ...store.context,
      followedMuteLists: [{ owner: 'hive.blog', members: ['alice'] }]
    }
    expect(store.decisionForSkin({ author: 'alice', reputation: 60 }).allowed).toBe(false)
    store.noteFollowChange('alice', true)
    const decision = store.decisionForSkin({ author: 'alice', reputation: 60 })
    expect(decision.allowed).toBe(true)
    expect(decision.code).toBe('followed-override')
  })

  it('persists skin settings and resets to the guest scope', async () => {
    const store = freshStore('viewer')
    await store.ensureContext()

    expect(store.setSkinSetting('blockMuted', false)).toBe(true)
    expect(store.skinSettings.blockMuted).toBe(false)
    const stored = JSON.parse(localStorage.getItem(moderationStorageKey('viewer')) || '{}')
    expect(stored.skins.blockMuted).toBe(false)

    store.reset()
    expect(store.scope).toBe('guest')
    expect(store.skinSettings.blockMuted).toBe(true)
  })

  it('uses the account record reputation when no explicit value is given', async () => {
    const store = freshStore('guest')
    const decision = store.decisionForSkin({
      author: 'alice',
      account: { name: 'alice', reputation: -100 }
    })
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('negative-reputation')
  })
})

describe('moderation store content decisions', () => {
  it('uses the loaded viewer context and preset for content', async () => {
    mocks.fetchViewerModerationContext.mockResolvedValue(context({ muted: ['alice'] }))
    const store = freshStore('viewer')
    await store.ensureContext()

    const balanced = store.decisionForContent({
      author: 'alice',
      post: { author: 'alice', author_reputation: 60, stats: {} },
      surface: 'feed'
    })
    expect(balanced.display).toBe('collapse')
    expect(balanced.primary.label).toBe('Muted by you')

    store.setPreset('open')
    const open = store.decisionForContent({
      author: 'alice',
      post: { author: 'alice', author_reputation: 60, stats: {} },
      surface: 'feed'
    })
    expect(open.display).toBe('label')
  })

  it('persists item, custom-rule and voter overrides', async () => {
    const store = freshStore('viewer')
    await store.ensureContext()

    store.showItem('alice/post')
    expect(store.showItems).toEqual(['alice/post'])
    const shown = store.decisionForContent({
      author: 'alice',
      post: { author: 'alice', author_reputation: 60, stats: {} },
      surface: 'feed',
      itemKey: 'alice/post'
    })
    expect(shown.display).toBe('show')

    store.setCustomRule('feed', 'mute', 'hide')
    expect(store.contentCustom.feed.mute).toBe('hide')
    store.ignoreVoter('@BadActor')
    expect(store.ignoredVoters).toEqual(['badactor'])
    store.unignoreVoter('badactor')
    expect(store.ignoredVoters).toEqual([])
  })

  it('exports and imports a policy document', async () => {
    const store = freshStore('viewer')
    await store.ensureContext()
    store.setPreset('strict')
    store.showItem('alice/post')

    const text = store.exportPolicyText()
    store.setPreset('open')
    store.showItem('bob/post')
    expect(store.contentPreset).toBe('open')

    const result = store.importPolicyText(text)
    expect(result.error).toBe('')
    expect(store.contentPreset).toBe('strict')
    expect(store.showItems).toContain('alice/post')
    expect(store.showItems).not.toContain('bob/post')
  })

  it('marks the first-use disclosure seen once', () => {
    const store = freshStore('viewer')
    expect(store.shouldDisclose).toBe(true)
    store.markDisclosureSeen()
    expect(store.shouldDisclose).toBe(false)
  })
})
