// Theme Wall view helpers.
//
// Skins have no published-at field in their on-chain manifest. The publishing
// operation is `account_update2`, so the account's last metadata update is the
// closest chain-native signal for "Recent".

import { isCredentialBadge } from '../data/badges/credentials'

export function isFeaturedSkin (theme) {
  if (!theme) return false
  const tags = Array.isArray(theme.tags) ? theme.tags : []
  if (tags.some(tag => String(tag).toLowerCase() === 'featured')) return true
  const selected = Array.isArray(theme.profile?.badges?.selected) ? theme.profile.badges.selected : []
  return selected.some(badge => isCredentialBadge(badge.source, badge.id))
}

export function skinActivityStamp (account) {
  return String(account?.last_account_update || account?.last_post || '')
}

export function byRecentActivity (a, b) {
  return skinActivityStamp(b.account).localeCompare(skinActivityStamp(a.account))
}
