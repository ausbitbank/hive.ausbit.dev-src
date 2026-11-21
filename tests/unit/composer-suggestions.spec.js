import { describe, expect, it } from 'vitest'
import { suggestTopics } from '../../src/services/composerSuggestions'

describe('topic suggestions', () => {
  it('keeps explicit hashtags first and excludes existing topics', () => {
    const topics = suggestTopics({
      title: '#HiveDev update',
      body: 'A post about #PeakD and building tools.',
      tags: ['peakd'],
      community: 'hive-139531'
    })
    expect(topics[0]).toBe('hivedev')
    expect(topics).not.toContain('peakd')
    expect(topics).not.toContain('hive-139531')
  })

  it('ranks meaningful title words above body words', () => {
    const topics = suggestTopics({
      title: 'Building a photography workflow',
      body: 'The workflow uses photography tools and a small workflow test.',
      tags: [],
      limit: 5
    })
    expect(topics).toContain('building')
    expect(topics).toContain('photography')
    expect(topics).toContain('workflow')
    expect(topics).not.toContain('the')
    expect(topics).not.toContain('small')
  })

  it('respects the requested limit and returns an empty list for noise', () => {
    expect(suggestTopics({ title: 'one two three four', body: 'five six', limit: 2 }).length).toBeLessThanOrEqual(2)
    expect(suggestTopics({ title: '', body: '', tags: [] })).toEqual([])
  })
})
