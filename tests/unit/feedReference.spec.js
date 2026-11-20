import { describe, expect, it } from 'vitest'
import {
  feedAvatar,
  feedHeader,
  parseFeedReference,
  resolveAccountFeed,
  resolvePostsFeed
} from '../../src/services/feedReference'

describe('feed reference parsing', () => {
  it('turns an account feed path into an account descriptor', () => {
    expect(parseFeedReference('/@ausbitbank/feed')).toMatchObject({
      kind: 'account',
      method: 'account',
      account: 'ausbitbank',
      sort: 'feed',
      eyebrow: 'Feed',
      heading: '@ausbitbank',
      link: '/@ausbitbank/feed',
      sortable: false
    })
  })

  it('accepts bare, uppercase and full-URL account paths', () => {
    expect(parseFeedReference('@AusbitBank/Blog')).toMatchObject({ account: 'ausbitbank', sort: 'blog' })
    expect(parseFeedReference('ausbitbank/replies')).toMatchObject({ account: 'ausbitbank', sort: 'replies' })
    expect(parseFeedReference('https://hive.ausbit.dev/@ausbitbank/feed?page=2#top')).toMatchObject({
      account: 'ausbitbank',
      sort: 'feed',
      link: '/@ausbitbank/feed'
    })
  })

  it('rejects an unknown account sub-page instead of guessing', () => {
    expect(parseFeedReference('/@ausbitbank/wallet')).toBeNull()
    expect(parseFeedReference('/@ausbitbank/hive-dev-post')).toBeNull()
  })

  it('reads community paths with an optional sort', () => {
    expect(parseFeedReference('/c/hive-dev')).toMatchObject({
      kind: 'community',
      tag: 'hive-dev',
      sort: 'trending',
      eyebrow: 'Community · Trending',
      heading: '#hive-dev',
      link: '/c/hive-dev'
    })
    expect(parseFeedReference('/c/hive-174578/created')).toMatchObject({
      kind: 'community',
      tag: 'hive-174578',
      sort: 'created',
      eyebrow: 'Community · New'
    })
  })

  it('reads short-form paths with a format', () => {
    expect(parseFeedReference('/shorts/threads')).toMatchObject({
      kind: 'short',
      method: 'short',
      shortFormat: 'threads',
      eyebrow: 'Short posts · InLeo',
      heading: 'Threads',
      link: '/shorts/threads'
    })
    expect(parseFeedReference('shorts')).toMatchObject({ shortFormat: 'threads' })
    expect(parseFeedReference('/shorts/unknown')).toBeNull()
  })

  it('reads global sorts and tagged sorts', () => {
    expect(parseFeedReference('/trending')).toMatchObject({
      kind: 'global',
      sort: 'trending',
      heading: 'Trending on Hive',
      link: '/trending'
    })
    expect(parseFeedReference('/payout_comments')).toMatchObject({
      kind: 'global',
      sort: 'payout_comments',
      heading: 'Top comments on Hive'
    })
    expect(parseFeedReference('/hot/photography')).toMatchObject({
      kind: 'tag',
      sort: 'hot',
      tag: 'photography',
      eyebrow: 'Tag · Hot',
      heading: '#photography',
      link: '/hot/photography'
    })
  })

  it('treats a bare word as a tag and ignores nonsense', () => {
    expect(parseFeedReference(' #Hive-Dev ')).toMatchObject({ kind: 'tag', tag: 'hive-dev' })
    expect(parseFeedReference('not a path!')).toBeNull()
    expect(parseFeedReference('')).toBeNull()
  })
})

describe('feed resolution', () => {
  it('builds the posts widget feed from a reference, then tag, then sort', () => {
    expect(resolvePostsFeed({ reference: '/@ausbitbank/feed', source: 'hot' })).toMatchObject({
      kind: 'account',
      account: 'ausbitbank',
      sort: 'feed'
    })
    expect(resolvePostsFeed({ reference: '', source: 'created', tag: '#hive-dev' })).toMatchObject({
      kind: 'tag',
      tag: 'hive-dev',
      sort: 'created',
      link: '/created/hive-dev'
    })
    expect(resolvePostsFeed({ reference: '', source: 'new', tag: '' })).toMatchObject({
      kind: 'global',
      sort: 'trending',
      heading: 'Trending on Hive'
    })
  })

  it('resolves @me against the signed-in user', () => {
    expect(resolvePostsFeed({ reference: '/@me/feed' }, { loggedInUser: 'alice' })).toMatchObject({
      kind: 'account',
      account: 'alice',
      sort: 'feed',
      heading: '@alice'
    })
    expect(resolveAccountFeed({ account: 'me', sort: 'blog' }, { loggedInUser: 'alice' })).toMatchObject({
      account: 'alice',
      sort: 'blog'
    })
  })

  it('lets a reference override the account widget settings', () => {
    expect(resolveAccountFeed({ reference: '/c/hive-dev', account: 'ausbitbank', sort: 'blog' })).toMatchObject({
      kind: 'community',
      heading: '#hive-dev'
    })
    expect(resolveAccountFeed({ reference: '/@ausbitbank/feed', account: 'ignored', sort: 'blog' })).toMatchObject({
      kind: 'account',
      account: 'ausbitbank',
      sort: 'feed'
    })
  })

  it('falls back to the signed-in user, then the site account, then blog', () => {
    expect(resolveAccountFeed({ account: '', sort: 'feed' }, { loggedInUser: 'alice', fallbackAccount: 'ausbitbank' })).toMatchObject({
      account: 'alice',
      sort: 'feed'
    })
    expect(resolveAccountFeed({ account: '', sort: 'nonsense' }, { loggedInUser: '', fallbackAccount: 'ausbitbank' })).toMatchObject({
      account: 'ausbitbank',
      sort: 'blog'
    })
  })
})

describe('feed headers', () => {
  it('uses the community title and avatar when the community record is known', () => {
    const feed = parseFeedReference('/c/hive-174578')
    expect(feedHeader(feed, { title: 'Hive Developers' })).toEqual({
      eyebrow: 'Community · Trending',
      heading: 'Hive Developers'
    })
    expect(feedAvatar(feed)).toBe('https://images.hive.blog/u/hive-174578/avatar')
  })

  it('falls back to the chain name while the community record loads or fails', () => {
    const feed = parseFeedReference('/c/hive-174578')
    expect(feedHeader(feed, null).heading).toBe('#hive-174578')
    expect(feedHeader(feed, { title: '   ' }).heading).toBe('#hive-174578')
  })

  it('never shows a community avatar for other feed kinds', () => {
    expect(feedAvatar(parseFeedReference('/@ausbitbank/feed'))).toBe('')
    expect(feedHeader(parseFeedReference('/trending'), { title: 'ignored' })).toEqual({
      eyebrow: 'Across Hive',
      heading: 'Trending on Hive'
    })
  })
})
