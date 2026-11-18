// Saved searches: local, shareable search shortcuts.
//
// Records are content-only (label, shareable URL and a description) and live in
// localStorage. Import accepts the app envelope, a bare array or one record.

export const SAVED_SEARCH_STORAGE_KEY = 'savedSearches'
export const SAVED_SEARCH_EXPORT_TYPE = 'hive-saved-searches'
export const SAVED_SEARCH_VERSION = 1
export const SAVED_SEARCH_LIMIT = 30

function cleanText (value, maxLength) {
  if (value === null || value === undefined) return ''
  return String(value).trim().slice(0, maxLength)
}

/** Validate a shareable search URL; anything else is rejected. */
export function normalizeSearchPath (value) {
  const text = cleanText(value, 2000)
  if (!text) return ''
  let path = text
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith('//')) {
    try {
      const url = new URL(text)
      if (url.origin !== 'https://hive.ausbit.dev') return ''
      path = url.pathname + (url.search || '')
    } catch {
      return ''
    }
  }
  if (!path.startsWith('/search')) return ''
  try {
    const url = new URL(path, 'https://hive.ausbit.dev')
    if (url.pathname !== '/search') return ''
    return '/search' + (url.search || '')
  } catch {
    return ''
  }
}

export function savedSearchRecord (raw, now = Date.now()) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const url = normalizeSearchPath(source.url)
  const label = cleanText(source.label, 120)
  if (!url || !label) return null
  const savedAt = Number(source.savedAt)
  return {
    label,
    url,
    description: cleanText(source.description, 160),
    savedAt: Number.isFinite(savedAt) && savedAt > 0 ? savedAt : now
  }
}

/** Newest first, de-duplicated by URL (newest wins) and capped at the limit. */
export function defaultSavedSearches (list) {
  const newest = new Map()
  for (const item of Array.isArray(list) ? list : []) {
    const record = savedSearchRecord(item)
    if (!record) continue
    const existing = newest.get(record.url)
    if (!existing || record.savedAt > existing.savedAt) newest.set(record.url, record)
  }
  return [...newest.values()]
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, SAVED_SEARCH_LIMIT)
}

export function addSavedSearch (list, record, now = Date.now()) {
  const clean = savedSearchRecord(record, now)
  if (!clean) return defaultSavedSearches(list)
  const existing = defaultSavedSearches(list).filter(item => item.url !== clean.url)
  return defaultSavedSearches([clean, ...existing])
}

export function removeSavedSearch (list, url) {
  const target = normalizeSearchPath(url)
  return defaultSavedSearches(list).filter(item => item.url !== target)
}

function parseStored (stored) {
  if (stored === null || stored === undefined || stored === '') return null
  if (typeof stored === 'object') return stored
  try {
    return JSON.parse(String(stored).replace(/^__q_objt\|/, ''))
  } catch {
    return null
  }
}

function readRaw (storage) {
  if (!storage) return null
  try {
    if (typeof storage.getItem === 'function') return storage.getItem(SAVED_SEARCH_STORAGE_KEY)
    if (typeof storage.get === 'function') return storage.get(SAVED_SEARCH_STORAGE_KEY)
  } catch {
    return null
  }
  return null
}

export function readSavedSearches (storage, now = Date.now()) {
  const parsed = parseStored(readRaw(storage))
  if (!parsed) return []
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.searches) ? parsed.searches : []
  return defaultSavedSearches(list.map(item => ({ ...item, savedAt: item?.savedAt || now })))
}

export function writeSavedSearches (storage, list) {
  if (!storage) return false
  const payload = {
    version: SAVED_SEARCH_VERSION,
    updatedAt: Date.now(),
    searches: defaultSavedSearches(list)
  }
  try {
    if (typeof storage.set === 'function') {
      storage.set(SAVED_SEARCH_STORAGE_KEY, payload)
      return true
    }
    if (typeof storage.setItem === 'function') {
      storage.setItem(SAVED_SEARCH_STORAGE_KEY, JSON.stringify(payload))
      return true
    }
  } catch {
    return false
  }
  return false
}

export function serializeSavedSearches (list) {
  return JSON.stringify({
    app: 'hive.ausbit.dev',
    type: SAVED_SEARCH_EXPORT_TYPE,
    version: SAVED_SEARCH_VERSION,
    exportedAt: new Date().toISOString(),
    searches: defaultSavedSearches(list)
  }, null, 2)
}

/** Parse an export file. Returns `{ searches, skipped, error }`. */
export function importSavedSearches (text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { searches: [], skipped: 0, error: 'The file is empty.' }
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { searches: [], skipped: 0, error: 'This file is not valid JSON.' }
  }
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.searches) ? parsed.searches : parsed ? [parsed] : []
  const candidateCount = list.length
  const searches = defaultSavedSearches(list.filter(item => item && typeof item === 'object'))
  if (!searches.length) {
    return { searches: [], skipped: candidateCount, error: 'No valid saved searches were found in this file.' }
  }
  return { searches, skipped: Math.max(0, candidateCount - searches.length), error: '' }
}
