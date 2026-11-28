import { describe, expect, it } from 'vitest'
import {
  MAX_IGNORED_TAGS,
  isTagIgnored,
  matchingIgnoredTag,
  normalizeIgnoredTag,
  normalizeIgnoredTags,
  postTagValues
} from '../../src/services/tagFilters'

describe('normalizeIgnoredTag', () => {
  it('trims, lowercases and strips leading hashes', () => {
    expect(normalizeIgnoredTag('  ##Hive-Dev  ')).toBe('hive-dev')
  })

  it('caps very long tags and rejects empty values', () => {
    expect(normalizeIgnoredTag('a'.repeat(80))).toHaveLength(64)
    expect(normalizeIgnoredTag('  ##  ')).toBe('')
    expect(normalizeIgnoredTag(null)).toBe('')
  })
})

describe('normalizeIgnoredTags', () => {
  it('dedupes, normalizes and preserves order', () => {
    expect(normalizeIgnoredTags(['#Hive', ' hive ', 'news', 'HIVE'])).toEqual(['hive', 'news'])
  })

  it('caps the list', () => {
    const tags = Array.from({ length: MAX_IGNORED_TAGS + 5 }, (_, index) => 'tag' + index)
    expect(normalizeIgnoredTags(tags)).toHaveLength(MAX_IGNORED_TAGS)
  })

  it('tolerates non-array input', () => {
    expect(normalizeIgnoredTags(null)).toEqual([])
    expect(normalizeIgnoredTags('hive')).toEqual([])
  })
})

describe('postTagValues', () => {
  it('collects category, reply target and metadata tags', () => {
    expect(postTagValues({
      category: 'Hive',
      parent_permlink: 'news',
      json_metadata: { tags: ['#photography', 'hive', 'news'] }
    })).toEqual(['hive', 'news', 'photography'])
  })

  it('parses string metadata and ignores malformed tags', () => {
    expect(postTagValues({
      category: 'art',
      json_metadata: JSON.stringify({ tags: ['sketch', 3, null, 'art'] })
    })).toEqual(['art', 'sketch'])
  })

  it('returns an empty list for missing posts', () => {
    expect(postTagValues(null)).toEqual([])
    expect(postTagValues({})).toEqual([])
  })
})

describe('matchingIgnoredTag', () => {
  const post = {
    category: 'hive-dev',
    json_metadata: { tags: ['javascript', 'open-source'] }
  }

  it('matches a category or a metadata tag case-insensitively', () => {
    expect(matchingIgnoredTag(post, ['javascript'])).toBe('javascript')
    expect(matchingIgnoredTag(post, ['#HIVE-DEV'])).toBe('hive-dev')
  })

  it('returns the first configured match and empty when none match', () => {
    expect(matchingIgnoredTag(post, ['news', 'open-source', 'javascript'])).toBe('open-source')
    expect(matchingIgnoredTag(post, ['news', 'music'])).toBe('')
    expect(matchingIgnoredTag(post, [])).toBe('')
  })
})

describe('isTagIgnored', () => {
  it('normalizes both sides of the comparison', () => {
    expect(isTagIgnored('#Hive', ['hive'])).toBe(true)
    expect(isTagIgnored('hive', ['#HIVE'])).toBe(true)
    expect(isTagIgnored('news', ['hive'])).toBe(false)
    expect(isTagIgnored('', ['hive'])).toBe(false)
  })
})
