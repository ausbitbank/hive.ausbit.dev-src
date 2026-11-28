// Saved downvote filter views.
//
// A view is just the query-string filter set, stored locally and scoped to the
// signed-in account. Loading one is the same code path as opening a deep link.

import { LocalStorage } from 'quasar'

const KEY_PREFIX = 'banksia:downvote-views:v1:'
export const MAX_VIEWS = 20
export const MAX_VIEW_NAME = 60

const FILTER_KEYS = ['range', 'rel', 'weight', 'impact', 'group', 'voter', 'target', 'notes', 'ignored', 'watch', 'new']

function keyFor (scope) {
  return KEY_PREFIX + String(scope || 'guest').toLowerCase()
}

function normalizeFilters (filters) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return {}
  const out = {}
  for (const key of FILTER_KEYS) {
    const value = filters[key]
    if (value === undefined || value === null || value === '') continue
    if (typeof value === 'boolean') {
      if (value) out[key] = '1'
      continue
    }
    const text = String(value).trim().slice(0, 200)
    if (text) out[key] = text
  }
  return out
}

function normalizeView (value) {
  if (!value || typeof value !== 'object') return null
  const name = String(value.name || '').trim().slice(0, MAX_VIEW_NAME)
  if (!name) return null
  return {
    name,
    filters: normalizeFilters(value.filters),
    summary: String(value.summary || '').trim().slice(0, 120),
    savedAt: value.savedAt || new Date().toISOString()
  }
}

function persist (scope, views) {
  try {
    if (!views.length) {
      LocalStorage.remove(keyFor(scope))
      return
    }
    LocalStorage.set(keyFor(scope), JSON.stringify(views))
  } catch {
    // Quota/private-mode failures leave the in-memory list usable.
  }
}

export function loadViews (scope = 'guest') {
  try {
    const raw = LocalStorage.getItem(keyFor(scope))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeView)
      .filter(Boolean)
      .slice(0, MAX_VIEWS)
  } catch {
    return []
  }
}

/** Save or replace a view by case-insensitive name. */
export function saveView (scope, name, filters, summary = '') {
  const view = normalizeView({ name, filters, summary })
  const views = loadViews(scope)
  if (!view) return views
  const index = views.findIndex(item => item.name.toLowerCase() === view.name.toLowerCase())
  if (index >= 0) views[index] = view
  else views.unshift(view)
  if (views.length > MAX_VIEWS) views.length = MAX_VIEWS
  persist(scope, views)
  return views
}

export function removeView (scope, name) {
  const needle = String(name || '').trim().toLowerCase()
  const views = loadViews(scope).filter(view => view.name.toLowerCase() !== needle)
  persist(scope, views)
  return views
}
