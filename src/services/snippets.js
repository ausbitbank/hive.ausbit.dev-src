// Local reusable text snippets for the composer.
//
// Snippets are plain text blocks. They never contain keys and are stored per
// account in the browser, alongside the local drafts.

export const SNIPPET_STORAGE_PREFIX = 'composeSnippets:'
export const SNIPPET_VERSION = 1
export const MAX_SNIPPETS = 40
export const MAX_SNIPPET_NAME = 80
export const MAX_SNIPPET_BODY = 20000

const ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/

function clean (value, max) {
  return String(value ?? '').slice(0, max).trim()
}

function newId (now = Date.now()) {
  return 'snippet-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

export function normalizeSnippet (raw, now = Date.now()) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const createdAt = Number(source.createdAt)
  const updatedAt = Number(source.updatedAt)
  return {
    id: typeof source.id === 'string' && source.id.trim() ? source.id.trim().slice(0, 80) : newId(now),
    owner: typeof source.owner === 'string' && ACCOUNT_RE.test(source.owner) ? source.owner : null,
    name: clean(source.name, MAX_SNIPPET_NAME),
    body: clean(source.body, MAX_SNIPPET_BODY),
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : now,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : now
  }
}

export function createSnippet (overrides = {}, now = Date.now()) {
  return normalizeSnippet({
    ...overrides,
    id: overrides.id || newId(now),
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now
  }, now)
}

export function snippetHasContent (snippet) {
  return Boolean(snippet && snippet.name && snippet.body)
}

export function sortSnippets (snippets) {
  return [...(Array.isArray(snippets) ? snippets : [])]
    .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
}

export function upsertSnippet (snippets, snippet, now = Date.now()) {
  const normalized = normalizeSnippet({ ...snippet, updatedAt: now }, now)
  const list = Array.isArray(snippets) ? snippets : []
  const index = list.findIndex(item => item.id === normalized.id)
  const next = index === -1
    ? [normalized, ...list]
    : list.map(item => item.id === normalized.id ? normalized : item)
  return sortSnippets(next).slice(0, MAX_SNIPPETS)
}

export function removeSnippetById (snippets, id) {
  return (Array.isArray(snippets) ? snippets : []).filter(item => item.id !== id)
}

function storageKey (owner) {
  const account = String(owner || '').trim().toLowerCase()
  return SNIPPET_STORAGE_PREFIX + (ACCOUNT_RE.test(account) ? account : 'guest')
}

function storageGet (storage, key) {
  if (!storage) return null
  if (typeof storage.getItem === 'function') return storage.getItem(key)
  if (typeof storage.get === 'function') return storage.get(key)
  return null
}

function storageSet (storage, key, value) {
  if (!storage) return false
  try {
    if (typeof storage.set === 'function') {
      storage.set(key, value)
      return true
    }
    if (typeof storage.setItem === 'function') {
      storage.setItem(key, JSON.stringify(value))
      return true
    }
  } catch {
    return false
  }
  return false
}

function storageRemove (storage, key) {
  if (!storage) return
  try {
    if (typeof storage.remove === 'function') storage.remove(key)
    else if (typeof storage.removeItem === 'function') storage.removeItem(key)
  } catch {
    // A convenience store should never block writing.
  }
}

function parse (raw) {
  if (!raw) return []
  if (typeof raw === 'object') return Array.isArray(raw.items) ? raw.items : []
  try {
    const parsed = JSON.parse(String(raw).replace(/^__q_objt\|/, ''))
    return Array.isArray(parsed?.items) ? parsed.items : []
  } catch {
    return []
  }
}

export function readSnippets (storage, owner = null, now = Date.now()) {
  return sortSnippets(
    parse(storageGet(storage, storageKey(owner)))
      .map(item => normalizeSnippet(item, now))
      .filter(snippetHasContent)
  ).slice(0, MAX_SNIPPETS)
}

export function writeSnippets (storage, owner, snippets, now = Date.now()) {
  const list = sortSnippets(
    (Array.isArray(snippets) ? snippets : [])
      .map(item => normalizeSnippet(item, now))
      .filter(snippetHasContent)
  ).slice(0, MAX_SNIPPETS)
  if (!list.length) {
    storageRemove(storage, storageKey(owner))
    return true
  }
  return storageSet(storage, storageKey(owner), { version: SNIPPET_VERSION, items: list })
}

export function serializeSnippetExport (snippets, { now = Date.now() } = {}) {
  return JSON.stringify({
    app: 'hive.ausbit.dev',
    type: 'hive-snippets',
    version: SNIPPET_VERSION,
    exportedAt: new Date(now).toISOString(),
    snippets: (Array.isArray(snippets) ? snippets : []).map(item => normalizeSnippet(item, now))
  }, null, 2)
}

export function parseSnippetExport (text, { now = Date.now(), owner = null } = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    return { snippets: [], error: 'The file is empty.' }
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { snippets: [], error: 'This file is not valid JSON.' }
  }
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed && parsed.snippets)
      ? parsed.snippets
      : []
  const snippets = list
    .map(item => normalizeSnippet({ ...item, owner: item.owner || owner || null }, now))
    .filter(snippetHasContent)
  if (!snippets.length) return { snippets: [], error: 'No snippets with a name and body were found.' }
  return { snippets, error: '' }
}

/** Merge imported snippets without overwriting newer local copies. */
export function mergeSnippets (existing, imported, { owner = null, now = Date.now() } = {}) {
  let snippets = Array.isArray(existing) ? [...existing] : []
  let added = 0
  let updated = 0
  let skipped = 0
  for (const raw of Array.isArray(imported) ? imported : []) {
    const snippet = normalizeSnippet({ ...raw, owner: raw.owner || owner || null }, now)
    if (!snippetHasContent(snippet)) {
      skipped += 1
      continue
    }
    const index = snippets.findIndex(item => item.id === snippet.id)
    if (index === -1) {
      snippets.push(snippet)
      added += 1
    } else if (snippet.updatedAt >= Number(snippets[index].updatedAt)) {
      snippets[index] = snippet
      updated += 1
    } else {
      skipped += 1
    }
  }
  snippets = sortSnippets(snippets).slice(0, MAX_SNIPPETS)
  return { snippets, added, updated, skipped }
}
