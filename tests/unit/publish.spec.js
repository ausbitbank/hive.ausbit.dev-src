import { describe, expect, it } from 'vitest'
import {
  buildCommentOptions,
  buildPostMetadata,
  buildPostOperation,
  canPublish,
  checklistErrors,
  createPostPermlink,
  normalizeMaxPayout,
  parseHivePostUrl,
  postQueueItem,
  publishChecklist,
  readCrossPostMetadata,
  resolveCategory,
  resolvedTags
} from '../../src/services/publish'

const draft = {
  title: 'A useful Hive post',
  body: 'Hello **Hive**.',
  tags: ['writing', 'hive-174578', 'hive'],
  community: 'hive-174578',
  beneficiaries: [{ account: 'ausbitbank', weight: 1000 }],
  rewards: { maxAcceptedPayout: '50.000 HBD', percentHbd: 5000, allowVotes: true, allowCurationRewards: true }
}

describe('post construction', () => {
  it('puts the community first and limits metadata tags', () => {
    expect(resolvedTags(draft)).toEqual(['hive-174578', 'writing', 'hive'])
    expect(resolveCategory(draft)).toBe('hive-174578')
    expect(resolveCategory({ tags: ['blog'] })).toBe('blog')
    expect(resolveCategory({})).toBe('')
    expect(resolvedTags({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] })).toHaveLength(5)
  })

  it('normalises payout values and permlinks', () => {
    expect(normalizeMaxPayout('100')).toBe('100.000 HBD')
    expect(normalizeMaxPayout('12.5 HBD')).toBe('12.500 HBD')
    expect(normalizeMaxPayout(0)).toBe('0.000 HBD')
    expect(normalizeMaxPayout('nope')).toBeNull()
    const permlink = createPostPermlink('Héllo, Hive World!', new Date('2026-11-18T12:34:56.789Z'))
    expect(permlink).toBe('hello-hive-world-20261118t123456z')
    expect(createPostPermlink('日本語', new Date('2026-11-18T00:00:00.000Z'))).toBe('post-20261118t000000z')
  })

  it('builds a posting-key comment operation with options and metadata', () => {
    const item = postQueueItem({
      username: 'Alice',
      draft,
      permlink: 'a-useful-hive-post-1',
      now: new Date('2026-11-18T00:00:00.000Z')
    })

    expect(item[0]).toBe('alice')
    expect(item[1]).toBe('posting')
    expect(item[2][0]).toBe('comment')
    expect(item[2][1]).toMatchObject({
      parent_author: '',
      parent_permlink: 'hive-174578',
      author: 'alice',
      permlink: 'a-useful-hive-post-1',
      title: draft.title,
      body: draft.body
    })
    expect(JSON.parse(item[2][1].json_metadata)).toMatchObject({
      app: 'hive.ausbit.dev',
      format: 'markdown',
      tags: ['hive-174578', 'writing', 'hive']
    })
    expect(item[2][1].comment_options).toMatchObject({
      author: 'alice',
      permlink: 'a-useful-hive-post-1',
      max_accepted_payout: '50.000 HBD',
      percent_hbd: 5000,
      allow_votes: true,
      allow_curation_rewards: true,
      extensions: [[0, { beneficiaries: [{ account: 'ausbitbank', weight: 1000 }] }]]
    })
  })

  it('omits beneficiary extensions when none are configured', () => {
    const options = buildCommentOptions({
      username: 'alice',
      permlink: 'post',
      beneficiaries: [],
      rewards: { percentHbd: 0, maxAcceptedPayout: 0 }
    })
    expect(options.extensions).toBeUndefined()
    expect(options.percent_hbd).toBe(0)
    expect(options.max_accepted_payout).toBe('0.000 HBD')
  })

  it('records cross-post attribution using the interoperable flags', () => {
    const metadata = buildPostMetadata({
      ...draft,
      crossPost: { author: 'bob', permlink: 'original-post' }
    })
    expect(metadata.cross_post).toBe(true)
    expect(metadata.original_author).toBe('bob')
    expect(metadata.original_permlink).toBe('original-post')
    expect(readCrossPostMetadata(metadata)).toEqual({ author: 'bob', permlink: 'original-post' })

    const operation = buildPostOperation({ username: 'alice', draft: { ...draft, crossPost: { author: 'bob', permlink: 'original-post' } } })
    const stored = JSON.parse(operation[1].json_metadata)
    expect(stored.cross_post).toBe(true)
    expect(stored.original_author).toBe('bob')
  })

  it('reads legacy cross_post objects and ignores malformed flags', () => {
    expect(readCrossPostMetadata({ cross_post: { author: 'bob', permlink: 'old' } })).toEqual({ author: 'bob', permlink: 'old' })
    expect(readCrossPostMetadata({ cross_post: true, original_author: 'bob', original_permlink: 'x' })).toEqual({ author: 'bob', permlink: 'x' })
    expect(readCrossPostMetadata({ cross_post: true })).toBeNull()
    expect(readCrossPostMetadata(null)).toBeNull()
  })

  it('builds an edit that keeps the parent and omits comment options', () => {
    const operation = buildPostOperation({
      username: 'alice',
      draft,
      permlink: 'existing-post',
      parentPermlink: 'original-category',
      commentOptions: false,
      previousMetadata: { image: ['https://img.example/one.jpg'], app: 'other.app' }
    })
    expect(operation[0]).toBe('comment')
    expect(operation[1]).toMatchObject({
      parent_author: '',
      parent_permlink: 'original-category',
      permlink: 'existing-post',
      _edit: true
    })
    expect(operation[1].comment_options).toBeUndefined()
    const metadata = JSON.parse(operation[1].json_metadata)
    expect(metadata.image).toEqual(['https://img.example/one.jpg'])
    expect(metadata.app).toBe('hive.ausbit.dev')
  })

  it('reports the edit category as ok or warn', () => {
    const base = {
      ...draft,
      editing: { author: 'alice', permlink: 'existing', parentPermlink: 'hive-174578', previousMetadata: {} }
    }
    const same = publishChecklist({ ...base, community: 'hive-174578' }, { username: 'alice' })
    expect(same.find(item => item.id === 'editCategory').status).toBe('ok')

    const changed = publishChecklist({ ...base, community: 'other', tags: ['other'] }, { username: 'alice' })
    expect(changed.find(item => item.id === 'editCategory').status).toBe('warn')
  })

  it('queues a top-level post edit without comment options', () => {
    const item = postQueueItem({
      username: 'alice',
      draft,
      permlink: 'existing',
      parentPermlink: 'hive-174578',
      commentOptions: false
    })
    expect(item[2][1].parent_author).toBe('')
    expect(item[2][1].parent_permlink).toBe('hive-174578')
    expect(item[2][1].permlink).toBe('existing')
    expect(item[2][1]._edit).toBe(true)
    expect(item[2][1].comment_options).toBeUndefined()
  })

  it('builds a comment edit with its parent author and no title', () => {
    const commentDraft = {
      title: '',
      body: 'edited reply',
      tags: [],
      community: '',
      owner: 'alice',
      editing: {
        author: 'alice',
        permlink: 're-parent',
        parentAuthor: 'bob',
        parentPermlink: 'parent-post',
        previousMetadata: {}
      }
    }
    const operation = buildPostOperation({
      username: 'alice',
      draft: commentDraft,
      permlink: 're-parent',
      parentAuthor: 'bob',
      parentPermlink: 'parent-post',
      commentOptions: false,
      previousMetadata: {}
    })
    expect(operation[1]).toMatchObject({
      parent_author: 'bob',
      parent_permlink: 'parent-post',
      author: 'alice',
      permlink: 're-parent',
      title: '',
      body: 'edited reply'
    })
    // The stray comment_options is what caused
    // "A comment cannot accept a greater payout" on Keychain edits.
    expect(operation[1].comment_options).toBeUndefined()
    expect(operation[1]._edit).toBe(true)
  })

  it('does not require a title, tags or rewards when editing a comment', () => {
    const commentDraft = {
      title: '',
      body: 'edited reply',
      tags: [],
      community: '',
      owner: 'alice',
      editing: { author: 'alice', permlink: 're-parent', parentAuthor: 'bob', parentPermlink: 'parent-post', previousMetadata: {} }
    }
    const items = publishChecklist(commentDraft, { username: 'alice' })
    expect(checklistErrors(items)).toEqual([])
    expect(items.find(item => item.id === 'title').status).toBe('ok')
    expect(items.find(item => item.id === 'tags').status).toBe('ok')
    expect(canPublish(commentDraft, { username: 'alice' })).toBe(true)
  })

  it('rejects missing accounts and categories', () => {
    expect(() => buildPostOperation({ username: '', draft })).toThrow(/valid Hive account/)
    expect(() => buildPostOperation({ username: 'alice', draft: { ...draft, community: '', tags: [] } })).toThrow(/community or first tag/)
  })
})

describe('Hive post URLs', () => {
  it('parses full, @-prefixed and bare post references', () => {
    expect(parseHivePostUrl('https://hive.ausbit.dev/@ausbitbank/my-post?x=1')).toEqual({ author: 'ausbitbank', permlink: 'my-post' })
    expect(parseHivePostUrl('https://peakd.com/hive-174578/@alice/hello-world#comments')).toEqual({ author: 'alice', permlink: 'hello-world' })
    expect(parseHivePostUrl('@alice/hello-world')).toEqual({ author: 'alice', permlink: 'hello-world' })
    expect(parseHivePostUrl('alice/hello-world')).toEqual({ author: 'alice', permlink: 'hello-world' })
    expect(parseHivePostUrl('not a post')).toBeNull()
    expect(parseHivePostUrl('@al/hello')).toBeNull()
  })
})

describe('publish checklist', () => {
  it('blocks publishing until login, title, body and tags are present', () => {
    const items = publishChecklist({ title: '', body: '', tags: [], community: '' }, { username: null })
    const errors = checklistErrors(items).map(item => item.id)
    expect(errors).toEqual(expect.arrayContaining(['login', 'title', 'body', 'tags']))
    expect(canPublish({ title: '', body: '' })).toBe(false)
  })

  it('passes a complete draft and explains authorities and beneficiaries', () => {
    const items = publishChecklist(draft, { username: 'alice' })
    expect(checklistErrors(items)).toEqual([])
    expect(canPublish(draft, { username: 'alice' })).toBe(true)
    expect(items.find(item => item.id === 'authority').detail).toMatch(/posting key only/i)
    expect(items.find(item => item.id === 'beneficiaries').detail).toContain('author 90%')
  })

  it('flags over-allocated beneficiaries and bad payout values', () => {
    const items = publishChecklist({
      ...draft,
      beneficiaries: [
        { account: 'alice', weight: 10000 },
        { account: 'bob', weight: 5000 }
      ],
      rewards: { ...draft.rewards, maxAcceptedPayout: 'not money' }
    }, { username: 'alice' })
    const ids = checklistErrors(items).map(item => item.id)
    expect(ids).toContain('beneficiaries')
    expect(ids).toContain('rewards')
  })

  it('warns about long titles without blocking', () => {
    const items = publishChecklist({ ...draft, title: 'A'.repeat(140) }, { username: 'alice' })
    expect(items.find(item => item.id === 'title').status).toBe('warn')
    expect(checklistErrors(items)).toEqual([])
  })

  it('blocks malformed beneficiary rows instead of silently dropping them', () => {
    const items = publishChecklist({
      ...draft,
      beneficiaries: [{ account: 'Not An Account', weight: 1000 }]
    }, { username: 'alice' })
    expect(checklistErrors(items).map(item => item.id)).toContain('beneficiaries')
  })
})
