import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = {
  accounts: [],
  nameSearch: [],
  posts: [],
  communities: [],
  witnesses: [],
  proposals: [],
  block: null,
  authorPosts: [],
  semantic: { ok: false, posts: [] },
  semanticAuthors: { ok: false, authors: [] },
  fail: {}
}

function reset () {
  state.accounts = [{ name: 'alice' }]
  state.nameSearch = [{ name: 'alice' }]
  state.posts = [{
    author: 'alice',
    permlink: 'hive-post',
    title: 'Hive post',
    body: 'hive',
    category: 'hive',
    created: '2026-01-01T00:00:00',
    json_metadata: { tags: ['hive', 'test'] },
    net_votes: 4,
    children: 1
  }]
  state.communities = [{ name: 'hive-123', title: 'Hive community', about: 'hive' }]
  state.witnesses = [{ owner: 'alice', votes: 10 }]
  state.proposals = [{ proposal_id: 1, subject: 'hive proposal', creator: 'alice' }]
  state.block = { timestamp: '2026-01-01T00:00:00', witness: 'alice', transaction_ids: ['a', 'b'] }
  state.authorPosts = [{ author: 'alice', permlink: 'p1', title: 'One', created: '2026-01-01T00:00:00', json_metadata: {} }]
  state.semantic = { ok: false, posts: [] }
  state.semanticAuthors = { ok: false, authors: [] }
  state.fail = {}
}

function failIf (name, value) {
  if (state.fail[name]) throw new Error(name + ' failed')
  return value
}

vi.mock('../../src/services/chainData', () => ({
  fetchAccountNameSearch: vi.fn(async () => failIf('nameSearch', state.nameSearch)),
  fetchAccounts: vi.fn(async () => failIf('accounts', state.accounts)),
  fetchAccountPosts: vi.fn(async () => failIf('authorPosts', state.authorPosts)),
  fetchBlockHeader: vi.fn(async () => failIf('block', state.block)),
  fetchCommunitySearch: vi.fn(async () => failIf('communities', state.communities)),
  fetchHiveSenseAuthors: vi.fn(async () => failIf('semanticAuthors', state.semanticAuthors)),
  fetchHiveSenseSearch: vi.fn(async () => failIf('semantic', state.semantic)),
  fetchPostSearch: vi.fn(async () => failIf('posts', state.posts)),
  fetchWitnessesByVote: vi.fn(async () => failIf('witnesses', state.witnesses))
}))

vi.mock('../../src/services/proposals', () => ({
  listProposals: vi.fn(async () => failIf('proposals', state.proposals))
}))

beforeEach(() => {
  vi.clearAllMocks()
  reset()
})

async function load () {
  return import('../../src/services/searchReads')
}

describe('runUnifiedSearch', () => {
  it('returns empty groups for an empty query without touching the network', async () => {
    const { runUnifiedSearch } = await load()
    const chain = await import('../../src/services/chainData')
    const result = await runUnifiedSearch('   ')
    expect(result.query).toBe('')
    expect(result.accounts.items).toEqual([])
    expect(result.posts.items).toEqual([])
    expect(result.plan.kind).toBe('keyword')
    expect(chain.fetchPostSearch).not.toHaveBeenCalled()
    expect(chain.fetchAccounts).not.toHaveBeenCalled()
  })

  it('runs the keyword groups and keeps each result set', async () => {
    const { runUnifiedSearch } = await load()
    const result = await runUnifiedSearch('alice')

    expect(result.accounts.items.map(account => account.name)).toContain('alice')
    expect(result.posts.items.length).toBe(1)
    expect(result.tags.items.map(row => row.tag)).toContain('alice')
    expect(result.proposals.items.length).toBe(1)
    expect(result.witnesses.items.length).toBe(1)
    expect(result.blocks.items).toEqual([])
    expect(result.transactions.items).toEqual([])
    expect(result.semantic.attempted).toBe(true)
    expect(result.semantic.ok).toBe(false)
  })

  it('returns an explicit account with author context and no tag group', async () => {
    const { runUnifiedSearch } = await load()
    const chain = await import('../../src/services/chainData')
    const result = await runUnifiedSearch('@alice')

    expect(result.plan.kind).toBe('account')
    expect(result.authorContext.author).toBe('alice')
    expect(result.authorContext.facets).toBeTruthy()
    expect(chain.fetchAccountNameSearch).toHaveBeenCalled()
    expect(chain.fetchAccountPosts).toHaveBeenCalledWith({ account: 'alice', sort: 'posts', limit: 20 }, { force: false })
    expect(result.tags.items).toEqual([])
    expect(result.analytics).toBeNull()
  })

  it('resolves a block number and a transaction id directly', async () => {
    const { runUnifiedSearch } = await load()

    const block = await runUnifiedSearch('12345')
    expect(block.plan.kind).toBe('block')
    expect(block.blocks.items).toEqual([{
      blockNum: 12345,
      timestamp: '2026-01-01T00:00:00',
      witness: 'alice',
      txCount: 2
    }])

    const txId = 'a'.repeat(40)
    const tx = await runUnifiedSearch(txId)
    expect(tx.plan.kind).toBe('transaction')
    expect(tx.transactions.items).toEqual([{ txId }])
  })

  it('isolates a failing group instead of failing the search', async () => {
    const { runUnifiedSearch } = await load()
    state.fail.posts = true

    const result = await runUnifiedSearch('alice')
    expect(result.posts.error).toBe('Posts could not be loaded.')
    expect(result.communities.error).toBe('')
    expect(result.proposals.items.length).toBe(1)
    expect(result.witnesses.items.length).toBe(1)
  })

  it('honours a type filter and skips the unrelated groups', async () => {
    const { runUnifiedSearch } = await load()
    const chain = await import('../../src/services/chainData')
    const result = await runUnifiedSearch('alice', { type: 'posts' })

    expect(result.posts.items.length).toBe(1)
    expect(result.accounts.items).toEqual([])
    expect(result.proposals.items).toEqual([])
    expect(chain.fetchAccounts).not.toHaveBeenCalled()
    expect(chain.fetchWitnessesByVote).not.toHaveBeenCalled()
  })

  it('merges semantic posts ahead of keyword results when HiveSense answers', async () => {
    const { runUnifiedSearch } = await load()
    state.semantic = {
      ok: true,
      posts: [{ author: 'bob', permlink: 'semantic', title: 'Hive semantic', created: '2026-01-02T00:00:00', json_metadata: {} }]
    }
    state.semanticAuthors = { ok: true, authors: [{ name: 'bob' }] }
    const result = await runUnifiedSearch('hive')

    expect(result.semantic.ok).toBe(true)
    expect(result.semantic.count).toBe(1)
    expect(result.posts.items[0].author).toBe('bob')
    expect(result.posts.items[0].semantic).toBe(true)
    expect(result.recommendedAuthors).toEqual([{ name: 'bob' }])
  })

  it('passes force through to every read', async () => {
    const { runUnifiedSearch } = await load()
    const chain = await import('../../src/services/chainData')
    await runUnifiedSearch('@alice', {}, { force: true })
    expect(chain.fetchAccountNameSearch).toHaveBeenCalledWith('alice', 11, { force: true })
    expect(chain.fetchWitnessesByVote).toHaveBeenCalledWith(200, { force: true })
  })
})

describe('fetchAuthorContext', () => {
  it('normalises the account and tolerates a failed read', async () => {
    const { fetchAuthorContext } = await load()
    const chain = await import('../../src/services/chainData')

    expect(await fetchAuthorContext('  @Alice ')).toHaveLength(1)
    expect(chain.fetchAccountPosts).toHaveBeenCalledWith({ account: 'alice', sort: 'posts', limit: 20 }, { force: false })

    state.fail.authorPosts = true
    expect(await fetchAuthorContext('alice')).toEqual([])
    expect(await fetchAuthorContext('')).toEqual([])
  })
})
