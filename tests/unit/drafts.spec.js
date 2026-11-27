import { describe, expect, it } from 'vitest'
import {
  DRAFT_STORAGE_KEY,
  MAX_DRAFTS,
  MAX_TAGS,
  appendDraftHistory,
  createDraft,
  defaultAiTools,
  defaultRewards,
  draftDisplayTitle,
  draftExportFileName,
  draftHasContent,
  draftLengthGuidance,
  hasAiTools,
  mergeImportedDrafts,
  normalizeBeneficiaries,
  normalizeDraft,
  normalizeTag,
  normalizeTags,
  parseDraftExport,
  readDraftHistory,
  readDraftState,
  readDrafts,
  readPinnedDraftIds,
  removeDraftById,
  removeDraftHistory,
  restoreDraftSnapshot,
  serializeDraftExport,
  sortDrafts,
  togglePinnedDraftId,
  upsertDraft,
  writeDrafts,
  writePinnedDraftIds
} from '../../src/services/drafts'

function memoryStorage () {
  const map = new Map()
  return {
    map,
    getItem (key) { return map.has(key) ? map.get(key) : null },
    setItem (key, value) { map.set(key, value) },
    removeItem (key) { map.delete(key) }
  }
}

function quasarStorage () {
  const map = new Map()
  return {
    map,
    get (key) { return map.has(key) ? map.get(key) : null },
    set (key, value) { map.set(key, value) },
    remove (key) { map.delete(key) }
  }
}

const validDraft = {
  title: 'A useful Hive post',
  body: 'Hello **Hive**.',
  tags: ['hive', 'writing'],
  community: 'hive-174578',
  beneficiaries: [{ account: 'ausbitbank', weight: 1000 }],
  rewards: { maxAcceptedPayout: '50.000 HBD', percentHbd: 5000, allowVotes: true, allowCurationRewards: true }
}

describe('draft normalization', () => {
  it('creates independent drafts and normalizes user input', () => {
    const first = createDraft({ title: 'One' }, 1000)
    const second = createDraft({ title: 'Two' }, 1000)
    expect(first.id).not.toBe(second.id)
    expect(first.createdAt).toBe(1000)
    expect(first.rewards.percentHbd).toBe(10000)
    expect(first.owner).toBeNull()
  })

  it('cleans and deduplicates tags and communities', () => {
    expect(normalizeTag(' #My Tag ')).toBe('my-tag')
    expect(normalizeTag('hive-174578')).toBe('hive-174578')
    expect(normalizeTag('bad tag!')).toBe('bad-tag')
    expect(normalizeTag('!!!')).toBe('')
    expect(normalizeTag('hive.ausbit.dev')).toBe('hive-ausbit-dev')
    expect(normalizeTag('a'.repeat(40))).toHaveLength(24)
    expect(normalizeTags(['#Hive', 'hive', 'My Post', 'a', 'b', 'c', 'd'])).toEqual(['hive', 'my-post', 'a', 'b', 'c', 'd'])
    expect(normalizeTags('one, two three')).toEqual(['one', 'two', 'three'])
    expect(normalizeTags(Array.from({ length: 10 }, (_, index) => 'tag' + index))).toHaveLength(MAX_TAGS)
  })

  it('normalises media, AI, countdown and advanced presentation fields', () => {
    const draft = createDraft({
      description: '  A short   description ',
      coverImage: 'https://images.hive.blog/cover.jpg',
      aiTools: { media_generation: true, translation: true, bogus: true },
      countdown: '2026-12-01T10:00:00.000Z',
      portfolio: true,
      collection: true,
      authorDisplay: '  Jane   Doe ',
      rewards: { maxAcceptedPayout: '0.000 HBD' }
    }, 1000)

    expect(draft.description).toBe('A short description')
    expect(draft.coverImage).toBe('https://images.hive.blog/cover.jpg')
    expect(draft.aiTools).toEqual({
      media_generation: true,
      translation: true,
      post_draft: false,
      writing_edit: false,
      research: false,
      other: false
    })
    expect(draft.countdown).toBe('2026-12-01T10:00:00.000Z')
    expect(draft.portfolio).toBe(true)
    expect(draft.collection).toBe(true)
    expect(draft.authorDisplay).toBe('Jane Doe')
    expect(draft.rewards.decline).toBe(true)
    expect(draft.rewards.maxAcceptedPayout).toBe('0.000 HBD')
  })

  it('normalises scheduled reminders and archive timestamps', () => {
    const draft = createDraft({
      scheduledAt: '2030-01-01T10:00:00.000Z',
      archivedAt: 12345
    }, 1000)
    expect(draft.scheduledAt).toBe('2030-01-01T10:00:00.000Z')
    expect(draft.archivedAt).toBe(12345)
    expect(createDraft({ scheduledAt: 'not-a-date', archivedAt: 'nope' }, 1000).scheduledAt).toBe('')
    expect(createDraft({ archivedAt: 'nope' }, 1000).archivedAt).toBeNull()
  })

  it('drops unsafe cover URLs and invalid countdown values', () => {
    const draft = createDraft({
      coverImage: 'javascript:alert(1)',
      countdown: 'not-a-date'
    }, 1000)
    expect(draft.coverImage).toBe('')
    expect(draft.countdown).toBe('')
  })

  it('validates beneficiaries, deduplicates accounts and caps the list', () => {
    const list = normalizeBeneficiaries([
      { account: 'AUSBITBANK', weight: 1000 },
      { account: 'ausbitbank', weight: 2000 },
      { account: 'ab', weight: 1000 },
      { account: 'alice', weight: 0 },
      { account: 'bob', weight: 25000 },
      ...Array.from({ length: 10 }, (_, index) => ({ account: 'user' + index, weight: 100 }))
    ])
    expect(list[0]).toEqual({ account: 'ausbitbank', weight: 1000 })
    expect(list[1]).toEqual({ account: 'bob', weight: 10000 })
    expect(list).toHaveLength(8)
  })

  it('fills display titles from the first body line', () => {
    expect(draftDisplayTitle({ title: 'Title', body: 'Body' })).toBe('Title')
    expect(draftDisplayTitle({ title: '', body: '# Heading\n\nBody' })).toBe('Heading')
    expect(draftDisplayTitle({ title: '  ', body: '' })).toBe('Untitled draft')
  })

  it('keeps only the newest drafts and stamps updates', () => {
    let drafts = []
    for (let index = 0; index < MAX_DRAFTS + 5; index++) {
      drafts = upsertDraft(drafts, { id: 'draft-' + index, title: 'Post ' + index }, 1000 + index)
    }
    expect(drafts).toHaveLength(MAX_DRAFTS)
    expect(drafts[0].id).toBe('draft-' + (MAX_DRAFTS + 4))

    drafts = upsertDraft(drafts, { ...drafts[0], title: 'Updated' }, 5000)
    expect(drafts[0].title).toBe('Updated')
    expect(drafts[0].updatedAt).toBe(5000)
  })
})

describe('draft storage', () => {
  it('round-trips drafts through raw and Quasar-style storage', () => {
    for (const storage of [memoryStorage(), quasarStorage()]) {
      const draft = createDraft(validDraft, 1000)
      expect(writeDrafts(storage, [draft], 2000)).toBe(true)
      const state = readDraftState(storage)
      expect(state.savedAt).toBe(2000)
      expect(state.drafts).toHaveLength(1)
      expect(state.drafts[0].title).toBe(validDraft.title)
      expect(state.drafts[0].community).toBe(validDraft.community)
    }
  })

  it('ignores empty drafts and removes corrupt payloads', () => {
    const storage = memoryStorage()
    writeDrafts(storage, [createDraft({ title: '', body: '   ' }, 1000)], 1000)
    expect(storage.map.get(DRAFT_STORAGE_KEY)).toBeUndefined()
    expect(readDrafts(storage)).toEqual([])

    storage.setItem(DRAFT_STORAGE_KEY, '{not json')
    expect(readDrafts(storage)).toEqual([])
    expect(storage.map.has(DRAFT_STORAGE_KEY)).toBe(false)
  })

  it('returns an empty state when storage throws', () => {
    const storage = {
      getItem () { throw new Error('blocked') },
      removeItem () {}
    }
    expect(readDraftState(storage)).toEqual({ drafts: [], savedAt: null })
    expect(writeDrafts({ setItem () { throw new Error('full') } }, [createDraft(validDraft)])).toBe(false)
  })

  it('removes one draft without touching others', () => {
    const drafts = [createDraft({ id: 'a', title: 'A' }), createDraft({ id: 'b', title: 'B' })]
    expect(removeDraftById(drafts, 'a').map(item => item.id)).toEqual(['b'])
  })
})

describe('draft history', () => {
  it('stores previous versions, throttles autosaves and restores content', () => {
    const storage = memoryStorage()
    const previous = createDraft({ id: 'draft-1', owner: 'alice', title: 'Old title', body: 'Old body' }, 1000)
    const current = createDraft({ ...previous, title: 'New title', body: 'New body' }, 2000)

    appendDraftHistory(storage, previous, { now: 2000, current })
    const first = readDraftHistory(storage)
    expect(first['draft-1']).toHaveLength(1)
    expect(first['draft-1'][0].title).toBe('Old title')

    // A second change within the throttle window does not add another snapshot.
    appendDraftHistory(storage, current, { now: 3000, current: { ...current, body: 'Newer body' } })
    expect(readDraftHistory(storage)['draft-1']).toHaveLength(1)

    appendDraftHistory(storage, current, {
      now: 3000,
      force: true,
      current: { ...current, body: 'Newer body' }
    })
    expect(readDraftHistory(storage)['draft-1']).toHaveLength(2)

    const restored = restoreDraftSnapshot(first['draft-1'][0], current, 4000)
    expect(restored.id).toBe('draft-1')
    expect(restored.owner).toBe('alice')
    expect(restored.title).toBe('Old title')
    expect(restored.body).toBe('Old body')
  })

  it('removes history for a specific draft', () => {
    const storage = memoryStorage()
    const previous = createDraft({ id: 'draft-1', title: 'Old', body: 'Body' }, 1000)
    appendDraftHistory(storage, previous, { now: 2000, force: true })
    expect(readDraftHistory(storage)['draft-1']).toHaveLength(1)
    removeDraftHistory(storage, 'draft-1')
    expect(readDraftHistory(storage)['draft-1']).toBeUndefined()
  })
})

describe('pinned drafts', () => {
  it('toggles draft ids per account and ignores duplicates', () => {
    const storage = memoryStorage()
    expect(togglePinnedDraftId(storage, 'alice', 'draft-a')).toEqual(['draft-a'])
    expect(togglePinnedDraftId(storage, 'alice', 'draft-b')).toEqual(['draft-b', 'draft-a'])
    expect(togglePinnedDraftId(storage, 'alice', 'draft-a')).toEqual(['draft-b'])
    expect(readPinnedDraftIds(storage, 'alice')).toEqual(['draft-b'])
    expect(readPinnedDraftIds(storage, 'bob')).toEqual([])
    writePinnedDraftIds(storage, 'alice', ['draft-b', 'draft-b', 'draft-c'])
    expect(readPinnedDraftIds(storage, 'alice')).toEqual(['draft-b', 'draft-c'])
  })
})

describe('draft export and import', () => {
  it('exports a versioned envelope and parses it back', () => {
    const draft = createDraft(validDraft, 1000)
    const text = serializeDraftExport(draft, { now: 3000 })
    const envelope = JSON.parse(text)
    expect(envelope.type).toBe('hive-drafts')
    expect(envelope.version).toBe(3)
    expect(envelope.exportedAt).toBe(new Date(3000).toISOString())

    const parsed = parseDraftExport(text, { owner: 'alice', now: 4000 })
    expect(parsed.error).toBe('')
    expect(parsed.drafts).toHaveLength(1)
    expect(parsed.drafts[0].owner).toBe('alice')
  })

  it('rejects invalid files and skips empty entries', () => {
    expect(parseDraftExport('')).toMatchObject({ drafts: [], error: 'The file is empty.' })
    expect(parseDraftExport('no').error).toMatch(/not valid JSON/)
    expect(parseDraftExport(JSON.stringify({ drafts: [{ title: '', body: '' }] })).error).toMatch(/content/)
    expect(parseDraftExport(JSON.stringify([{ title: 'Keep', body: '' }, { title: '', body: '' }]))).toMatchObject({
      skipped: 1,
      error: ''
    })
  })

  it('merges imports without overwriting newer local drafts', () => {
    const local = createDraft({ id: 'same', title: 'Local', updatedAt: 5000 }, 5000)
    const older = createDraft({ id: 'same', title: 'Older import', updatedAt: 1000 }, 1000)
    const newer = createDraft({ id: 'same', title: 'Newer import', updatedAt: 9000 }, 9000)
    const fresh = createDraft({ id: 'fresh', title: 'Fresh' }, 1000)

    const merged = mergeImportedDrafts([local], [older, fresh, newer], { now: 10000 })
    expect(merged.added).toBe(1)
    expect(merged.updated).toBe(1)
    expect(merged.skipped).toBe(1)
    expect(merged.drafts.find(item => item.id === 'same').title).toBe('Newer import')
    expect(merged.drafts.find(item => item.id === 'fresh').title).toBe('Fresh')
  })
})

describe('draft length guidance', () => {
  it('reports words, bytes and editorial ranges', () => {
    expect(draftLengthGuidance('')).toMatchObject({ level: 'empty', words: 0, bytes: 0 })
    expect(draftLengthGuidance('short post').level).toBe('short')
    expect(draftLengthGuidance(Array.from({ length: 200 }, () => 'word').join(' ')).level).toBe('good')
    expect(draftLengthGuidance('é'.repeat(33000))).toMatchObject({ level: 'too-long', maxBytes: 65535 })
    expect(draftLengthGuidance(Array.from({ length: 3000 }, () => 'word').join(' ')).level).toBe('long')
  })

  it('rejects malformed storage drafts without throwing', () => {
    const draft = normalizeDraft({ title: 42, body: null, tags: {}, community: 'BAD TAG!', beneficiaries: 'nope' }, 1000)
    expect(draft.title).toBe('42')
    expect(draft.body).toBe('')
    expect(draft.tags).toEqual([])
    expect(draft.community).toBe('bad-tag')
    expect(draft.beneficiaries).toEqual([])
    expect(draft.editing).toBeNull()
  })

  it('keeps edit state for the owner only', () => {
    const editing = {
      author: 'alice',
      permlink: 'my-post',
      parentAuthor: '',
      parentPermlink: 'hive-174578',
      previousMetadata: { image: ['https://img.example/a.png'] }
    }
    const own = normalizeDraft({ owner: 'alice', title: 'T', body: 'B', editing }, 1000)
    expect(own.editing).toEqual(editing)

    const reply = normalizeDraft({
      owner: 'alice',
      title: '',
      body: 'B',
      editing: { author: 'alice', permlink: 're-parent', parentAuthor: 'bob', parentPermlink: 'the-parent' }
    }, 1000)
    expect(reply.editing.parentAuthor).toBe('bob')

    const other = normalizeDraft({ owner: 'bob', title: 'T', body: 'B', editing }, 1000)
    expect(other.editing).toBeNull()

    expect(normalizeDraft({ owner: 'alice', title: 'T', body: 'B', editing: { author: 'alice', permlink: 'BAD PERMLINK' } }, 1000).editing).toBeNull()

    // A category that is not a valid tag still has to survive editing: Hive
    // keeps parent_permlink immutable.
    const legacy = normalizeDraft({
      owner: 'alice',
      title: 'T',
      body: 'B',
      editing: { author: 'alice', permlink: 'legacy-post', parentPermlink: 'hive.ausbit.dev' }
    }, 1000)
    expect(legacy.editing.parentPermlink).toBe('hive.ausbit.dev')
  })
})

describe('draft helper contracts', () => {
  it('detects content only when a title or body has non-whitespace', () => {
    expect(draftHasContent({ title: '', body: '   ' })).toBe(false)
    expect(draftHasContent({ title: '  ', body: '\n\n' })).toBe(false)
    expect(draftHasContent({ title: 'T', body: '' })).toBe(true)
    expect(draftHasContent({ title: '', body: 'B' })).toBe(true)
    expect(draftHasContent(null)).toBe(false)
  })

  it('sorts newest first without mutating the input', () => {
    const rows = [
      { id: 'old', updatedAt: 100 },
      { id: 'new', updatedAt: 300 },
      { id: 'mid', updatedAt: 200 }
    ]
    const sorted = sortDrafts(rows)
    expect(sorted.map(row => row.id)).toEqual(['new', 'mid', 'old'])
    expect(rows.map(row => row.id)).toEqual(['old', 'new', 'mid'])
    expect(sortDrafts(null)).toEqual([])
  })

  it('builds safe export filenames', () => {
    expect(draftExportFileName({ title: 'Hello, Hive!', body: '' })).toBe('hello-hive.hive-draft.json')
    expect(draftExportFileName({ title: '', body: 'First line\nsecond' })).toBe('first-line.hive-draft.json')
    expect(draftExportFileName({ title: '   ', body: '  ' })).toBe('untitled-draft.hive-draft.json')
    expect(draftExportFileName({ title: 'Ünïcode ✓ title', body: '' })).toBe('n-code-title.hive-draft.json')
    expect(draftExportFileName({ title: 'a'.repeat(80), body: '' })).toHaveLength('a'.repeat(60).length + '.hive-draft.json'.length)
  })

  it('returns fresh default reward and AI-tool objects', () => {
    const rewards = defaultRewards()
    expect(rewards).toMatchObject({ percentHbd: 10000, allowVotes: true, allowCurationRewards: true, decline: false })
    rewards.allowVotes = false
    expect(defaultRewards().allowVotes).toBe(true)

    expect(defaultAiTools()).toEqual({
      media_generation: false,
      translation: false,
      post_draft: false,
      writing_edit: false,
      research: false,
      other: false
    })
    expect(hasAiTools(null)).toBe(false)
    expect(hasAiTools({ translation: false })).toBe(false)
    expect(hasAiTools({ translation: true })).toBe(true)
  })
})
