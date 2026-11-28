// Last-visit marker for the downvote page.
//
// The timestamp is local to this device and account. It lets the page show what
// is new without silently marking anything as read on the chain.

import { LocalStorage } from 'quasar'

const KEY_PREFIX = 'banksia:downvotes:last-visit:v1:'

function keyFor (scope, account) {
  return KEY_PREFIX + String(scope || 'guest').toLowerCase() + ':' + String(account || '').toLowerCase()
}

export function loadLastVisit (scope = 'guest', account = '') {
  try {
    const value = Number(LocalStorage.getItem(keyFor(scope, account)))
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

export function saveLastVisit (scope = 'guest', account = '', time = Date.now()) {
  const value = Number(time)
  if (!Number.isFinite(value) || value <= 0) return 0
  try {
    LocalStorage.set(keyFor(scope, account), String(Math.round(value)))
  } catch {
    // Ignore quota/private-mode failures; the in-memory value still works.
  }
  return Math.round(value)
}
