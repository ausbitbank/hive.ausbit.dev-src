import { describe, expect, it } from 'vitest'
import {
  filterNotifications,
  mergeNotifications,
  notificationActor,
  notificationCategory,
  notificationPath,
  notificationTimestamp,
  notificationTypeLabel,
  plainNotificationMessage,
  unreadNotificationIds
} from '../../src/services/notifications'

const notifications = [
  { id: '4', msg: '@alice mentioned you in a post', url: 'alice/post', date: '2026-11-17T14:00:00', type: 'mention', score: 40 },
  { id: '3', msg: '@bob replied to your post', url: 'bob/re-post', date: '2026-11-17T13:00:00', type: 'reply', score: 30 },
  { id: '2', msg: '@carol voted on your post ($0.05)', url: 'ausbitbank/post', date: '2026-11-17T12:00:00', type: 'vote', score: 20 },
  { id: '1', msg: '@dave followed you', url: 'dave', date: '2026-11-17T11:00:00', type: 'follow', score: 10 }
]

describe('notification helpers', () => {
  it('strips markup, extracts actors and limits length', () => {
    expect(plainNotificationMessage('<b>@alice</b> voted')).toBe('@alice voted')
    expect(plainNotificationMessage('one   two\nthree')).toBe('one two three')
    expect(plainNotificationMessage('abcdef', 4)).toBe('abc…')
    expect(notificationActor('@alice mentioned you')).toBe('alice')
    expect(notificationActor('no mention')).toBe('')
  })

  it('builds safe in-app notification paths', () => {
    expect(notificationPath('@alice/post')).toBe('/@alice/post')
    expect(notificationPath('/alice/post')).toBe('/alice/post')
    expect(notificationPath('https://evil.example/x')).toBe('/')
    expect(notificationPath('javascript:alert(1)')).toBe('/')
    expect(notificationPath('')).toBe('/')
  })

  it('classifies notification types and labels them', () => {
    expect(notificationCategory({ type: 'vote' })).toBe('votes')
    expect(notificationCategory({ type: 'unvote' })).toBe('votes')
    expect(notificationCategory({ type: 'reply' })).toBe('replies')
    expect(notificationCategory({ type: 'mention' })).toBe('mentions')
    expect(notificationCategory({ type: 'follow' })).toBe('other')
    expect(notificationTypeLabel({ type: 'mention' })).toBe('Mention')
    expect(notificationTypeLabel({ type: 'custom_thing' })).toBe('custom thing')
  })

  it('parses both bridge date forms', () => {
    expect(notificationTimestamp('2026-11-17T13:03:01')).toBe(Date.parse('2026-11-17T13:03:01Z'))
    expect(notificationTimestamp('2026-11-17 13:03:01')).toBe(Date.parse('2026-11-17T13:03:01Z'))
    expect(notificationTimestamp('2026-11-17T13:03:01+00:00')).toBe(Date.parse('2026-11-17T13:03:01Z'))
    expect(notificationTimestamp('')).toBe(0)
    expect(notificationTimestamp('nope')).toBe(0)
  })

  it('finds unread notifications by last-read time or unread count', () => {
    expect([...unreadNotificationIds(notifications, '2026-11-17 13:30:00', 2)].sort())
      .toEqual(['4'])
    expect([...unreadNotificationIds(notifications, null, 2)].sort()).toEqual(['3', '4'])
    expect([...unreadNotificationIds(notifications, null, 99)].sort()).toEqual(['1', '2', '3', '4'])
  })

  it('filters by category and unread state', () => {
    expect(filterNotifications(notifications, { filter: 'votes' }).map(item => item.id)).toEqual(['2'])
    expect(filterNotifications(notifications, { filter: 'mentions', unreadOnly: true, unreadIds: new Set(['4']) }).map(item => item.id)).toEqual(['4'])
    expect(filterNotifications(notifications, { filter: 'other' }).map(item => item.id)).toEqual(['1'])
    expect(filterNotifications(notifications, { unreadOnly: true, unreadIds: new Set() })).toEqual([])
  })

  it('merges pages by id and keeps newest first', () => {
    const incoming = [
      { ...notifications[2], msg: 'updated vote' },
      { id: '5', date: '2026-11-17T15:00:00', type: 'vote', msg: 'new' }
    ]
    const merged = mergeNotifications(notifications, incoming)
    expect(merged).toHaveLength(5)
    expect(merged[0].id).toBe('5')
    expect(merged.find(item => item.id === '2').msg).toBe('updated vote')
    expect(merged.map(item => item.id)).toEqual(['5', '4', '3', '2', '1'])
  })
})
