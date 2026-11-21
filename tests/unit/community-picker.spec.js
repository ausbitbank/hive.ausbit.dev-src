import { describe, expect, it } from 'vitest'
import {
  buildCommunityPickerOptions,
  communityAvatarUrl,
  communityRulesLink,
  communitySubscriptionWarning,
  filterCommunityOptions,
  isOutsideSubscriptions,
  normalizeSubscriptionRows,
  subscribedCommunityNames
} from '../../src/services/communityPicker'

const subscriptions = [
  ['hive-174578', 'OCD', 'member', ''],
  ['hive-111111', 'Hive Governance', 'admin', ''],
  ['hive-123456', 'Photography', 'guest', '']
]

const info = {
  'hive-174578': {
    name: 'hive-174578',
    title: 'OCD',
    about: 'Original content.',
    subscribers: 23040
  },
  'hive-999999': {
    name: 'hive-999999',
    title: 'Long Tail',
    about: '',
    subscribers: 42
  }
}

describe('community picker options', () => {
  it('normalises tuple, string and object subscriptions', () => {
    expect(normalizeSubscriptionRows(['hive-1', ['hive-2', 'Two', 'mod'], { name: 'hive-3', title: 'Three' }]))
      .toEqual([
        { name: 'hive-1', title: 'hive-1', role: '' },
        { name: 'hive-2', title: 'Two', role: 'mod' },
        { name: 'hive-3', title: 'Three', role: '' }
      ])
    expect([...subscribedCommunityNames(subscriptions)]).toEqual([
      'hive-174578',
      'hive-111111',
      'hive-123456'
    ])
  })

  it('keeps My blog first and marks subscribed and selected options', () => {
    const options = buildCommunityPickerOptions({
      subscriptions,
      recent: ['hive-123456', 'hive-777777'],
      info,
      selected: 'hive-999999',
      owner: 'alice'
    })
    expect(options[0]).toMatchObject({ value: '', isBlog: true, title: 'My blog' })
    expect(options[1]).toMatchObject({ value: 'hive-999999', subscribed: false })
    expect(options.find(option => option.value === 'hive-174578')).toMatchObject({
      title: 'OCD',
      subscribers: 23040,
      subscribed: true,
      label: 'OCD · hive-174578'
    })
    expect(options.find(option => option.value === 'hive-777777')).toMatchObject({
      recent: true,
      subscribed: false
    })
  })

  it('searches title, name and #tag without case sensitivity', () => {
    const options = buildCommunityPickerOptions({ subscriptions, info, owner: 'alice' })
    expect(options.find(option => option.value === 'hive-174578').label).toBe('OCD · hive-174578')
    expect(filterCommunityOptions(options, 'ocd').map(option => option.value)).toEqual(['hive-174578'])
    expect(filterCommunityOptions(options, 'hive-111111').map(option => option.value)).toEqual(['hive-111111'])
    expect(filterCommunityOptions(options, '#HIVE-123')).toHaveLength(1)
    expect(filterCommunityOptions(options, '')).toHaveLength(options.length)
  })

  it('builds avatars and rules links only for community names', () => {
    expect(communityAvatarUrl('hive-174578')).toBe('https://images.hive.blog/u/hive-174578/avatar/small')
    expect(communityAvatarUrl('', 'alice')).toBe('https://images.hive.blog/u/alice/avatar/small')
    expect(communityAvatarUrl('not a tag')).toBe('')
    expect(communityRulesLink('hive-174578')).toBe('/c/hive-174578?tab=about')
    expect(communityRulesLink('')).toBe('')
  })
})

describe('community subscription warnings', () => {
  it('warns only for signed-in users outside their subscriptions', () => {
    expect(isOutsideSubscriptions('hive-174578', subscriptions)).toBe(false)
    expect(isOutsideSubscriptions('hive-999999', subscriptions)).toBe(true)
    expect(isOutsideSubscriptions('', subscriptions)).toBe(false)

    expect(communitySubscriptionWarning('hive-174578', {
      subscriptions,
      owner: 'alice'
    })).toBe('')
    expect(communitySubscriptionWarning('hive-999999', {
      subscriptions,
      owner: 'alice'
    })).toContain('#hive-999999')
    expect(communitySubscriptionWarning('hive-999999', {
      subscriptions,
      owner: null
    })).toBe('')
    expect(communitySubscriptionWarning('hive-999999', {
      subscriptions,
      owner: 'alice',
      loaded: false
    })).toBe('')
  })
})
