// Local draft storage for the creator workflow.
//
// Drafts are content-only and never contain keys. They live in localStorage
// behind a small pure API so autosave, export/import and tests share the same
// normalisation and quota handling.

import { byteLength, readingMinutes, wordCount } from '../utils/markdownEditor'

export const DRAFT_STORAGE_KEY = 'composeDrafts'
export const DRAFT_EXPORT_TYPE = 'hive-drafts'
export const DRAFT_VERSION = 1
export const MAX_DRAFTS = 40
export const MAX_TITLE_CHARS = 255
export const MAX_BODY_BYTES = 65535
export const MAX_TAGS = 5
export const MAX_BENEFICIARIES = 8

const ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/
const TAG_RE = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/

export const MAX_ACCEPTED_PAYOUT = '100000.000 HBD'

export function defaultRewards () {
  return {
    maxAcceptedPayout: MAX_ACCEPTED_PAYOUT,
    percentHbd: 10000,
    allowVotes: true,
    allowCurationRewards: true
  }
}

function cleanString (value, maxLength = 100000) {
  if (value === null || value === undefined) return ''
  return String(value).slice(0, maxLength)
}

export function normalizeTag (value) {
  const text = cleanString(value, 60)
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  return TAG_RE.test(text) ? text : ''
}

export function normalizeTags (tags) {
  if (tags && typeof tags === 'object' && !Array.isArray(tags)) return []
  const source = Array.isArray(tags)
    ? tags
    : String(tags || '').split(/[,\s]+/)
  const seen = new Set()
  const out = []
  for (const tag of source) {
    const value = normalizeTag(tag)
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
    if (out.length >= MAX_TAGS) break
  }
  return out
}

export function normalizeBeneficiaries (list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const out = []
  for (const item of list) {
    const account = cleanString(item && item.account, 16).trim().toLowerCase()
    const weight = Math.round(Number(item && item.weight))
    if (!ACCOUNT_RE.test(account) || seen.has(account) || !Number.isFinite(weight) || weight <= 0) continue
    seen.add(account)
    out.push({ account, weight: Math.min(10000, weight) })
    if (out.length >= MAX_BENEFICIARIES) break
  }
  return out
}

export function normalizeCrossPost (value) {
  if (!value || typeof value !== 'object') return null
  const author = cleanString(value.author, 16).trim().toLowerCase()
  const permlink = cleanString(value.permlink, 255).trim().toLowerCase()
  if (!ACCOUNT_RE.test(author)) return null
  if (!/^[a-z0-9][a-z0-9-]{0,254}$/.test(permlink)) return null
  return { author, permlink }
}

export function normalizeRewards (value) {
  const rewards = value && typeof value === 'object' ? value : {}
  const percent = Number(rewards.percentHbd)
  return {
    maxAcceptedPayout: cleanString(rewards.maxAcceptedPayout, 40).trim() || MAX_ACCEPTED_PAYOUT,
    percentHbd: Number.isFinite(percent) ? Math.min(10000, Math.max(0, Math.round(percent))) : 10000,
    allowVotes: rewards.allowVotes !== false,
    allowCurationRewards: rewards.allowCurationRewards !== false
  }
}

function newId (now = Date.now()) {
  return 'draft-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

/** Coerce anything loaded from storage or an import file into a safe draft. */
export function normalizeDraft (raw, now = Date.now()) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const createdAt = Number(source.createdAt)
  const updatedAt = Number(source.updatedAt)
  return {
    id: typeof source.id === 'string' && source.id.trim() ? source.id.trim().slice(0, 80) : newId(now),
    owner: typeof source.owner === 'string' && ACCOUNT_RE.test(source.owner) ? source.owner : null,
    title: cleanString(source.title, MAX_TITLE_CHARS),
    body: cleanString(source.body, MAX_BODY_BYTES * 2),
    tags: normalizeTags(source.tags),
    community: normalizeTag(source.community),
    crossPost: normalizeCrossPost(source.crossPost),
    beneficiaries: normalizeBeneficiaries(source.beneficiaries),
    rewards: normalizeRewards(source.rewards),
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : now,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : now
  }
}

export function createDraft (overrides = {}, now = Date.now()) {
  return normalizeDraft({
    ...overrides,
    id: overrides.id || newId(now),
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now
  }, now)
}

/** True when the draft has anything worth saving. */
export function draftHasContent (draft) {
  return Boolean(draft && (String(draft.title || '').trim() || String(draft.body || '').trim()))
}

/** Human title with a body-first-line fallback for untitled drafts. */
export function draftDisplayTitle (draft) {
  const title = String(draft && draft.title || '').trim()
  if (title) return title
  const lines = String(draft && draft.body || '').split('\n')
  for (const line of lines) {
    const text = line.replace(/^#{1,6}\s*/, '').replace(/^[>*+-]\s*/, '').trim()
    if (text) return text.slice(0, 80)
  }
  return 'Untitled draft'
}

/**
 * Length guidance for the editor. The Hive body limit is the hard stop; the
 * word ranges are editorial guidance, not chain rules.
 */
export function draftLengthGuidance (body) {
  const text = String(body || '')
  const words = wordCount(text)
  const bytes = byteLength(text)
  const minutes = readingMinutes(text)
  const characters = Array.from(text).length

  let level
  let message
  if (bytes > MAX_BODY_BYTES) {
    level = 'too-long'
    message = 'Over the 65,535-byte Hive body limit. Trim the post before publishing.'
  } else if (!words) {
    level = 'empty'
    message = 'Start writing — drafts autosave on this device.'
  } else if (words < 120) {
    level = 'short'
    message = 'Short post — add a little context if the idea needs it.'
  } else if (words <= 2500) {
    level = 'good'
    message = 'Comfortable length — roughly ' + minutes + ' min read.'
  } else {
    level = 'long'
    message = 'Long read — consider splitting into a series if it keeps growing.'
  }

  return {
    words,
    characters,
    bytes,
    minutes,
    level,
    message,
    maxBytes: MAX_BODY_BYTES,
    remainingBytes: MAX_BODY_BYTES - bytes
  }
}

export function sortDrafts (drafts) {
  return [...(Array.isArray(drafts) ? drafts : [])]
    .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
}

/** Insert or replace a draft, stamping updatedAt and enforcing the list limit. */
export function upsertDraft (drafts, draft, now = Date.now()) {
  const normalized = normalizeDraft({ ...draft, updatedAt: now }, now)
  const list = Array.isArray(drafts) ? drafts : []
  const index = list.findIndex(item => item.id === normalized.id)
  const next = index === -1
    ? [normalized, ...list]
    : list.map(item => item.id === normalized.id ? normalized : item)
  return sortDrafts(next).slice(0, MAX_DRAFTS)
}

export function removeDraftById (drafts, id) {
  return (Array.isArray(drafts) ? drafts : []).filter(draft => draft.id !== id)
}

function storageGet (storage, key) {
  if (!storage) return null
  if (typeof storage.getItem === 'function') return storage.getItem(key)
  if (typeof storage.get === 'function') return storage.get(key)
  return null
}

function storageSet (storage, key, value) {
  if (!storage) return false
  if (typeof storage.set === 'function') {
    storage.set(key, value)
    return true
  }
  if (typeof storage.setItem === 'function') {
    storage.setItem(key, value)
    return true
  }
  return false
}

function storageRemove (storage, key) {
  if (!storage) return
  if (typeof storage.remove === 'function') return storage.remove(key)
  if (typeof storage.removeItem === 'function') return storage.removeItem(key)
}

function parseStored (stored) {
  if (stored === null || stored === undefined || stored === '') return null
  if (typeof stored === 'object') return stored
  const text = String(stored).replace(/^__q_objt\|/, '')
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Read drafts plus the last save time. Corrupt storage is discarded safely. */
export function readDraftState (storage, now = Date.now()) {
  const empty = { drafts: [], savedAt: null }
  try {
    const stored = storageGet(storage, DRAFT_STORAGE_KEY)
    if (stored === null || stored === undefined || stored === '') return empty
    const parsed = parseStored(stored)
    if (!parsed) {
      storageRemove(storage, DRAFT_STORAGE_KEY)
      return empty
    }
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.drafts) ? parsed.drafts : []
    const drafts = list
      .map(item => normalizeDraft(item, now))
      .filter(draftHasContent)
    return {
      drafts: sortDrafts(drafts).slice(0, MAX_DRAFTS),
      savedAt: Number.isFinite(Number(parsed.savedAt)) ? Number(parsed.savedAt) : null
    }
  } catch {
    storageRemove(storage, DRAFT_STORAGE_KEY)
    return empty
  }
}

export function readDrafts (storage, now = Date.now()) {
  return readDraftState(storage, now).drafts
}

/** Persist drafts. Returns false when storage is unavailable or over quota. */
export function writeDrafts (storage, drafts, now = Date.now()) {
  const normalized = sortDrafts(
    (Array.isArray(drafts) ? drafts : [])
      .map(item => normalizeDraft(item, now))
      .filter(draftHasContent)
  ).slice(0, MAX_DRAFTS)
  const payload = {
    version: DRAFT_VERSION,
    savedAt: now,
    drafts: normalized
  }
  try {
    if (!normalized.length) {
      storageRemove(storage, DRAFT_STORAGE_KEY)
      return true
    }
    return storageSet(storage, DRAFT_STORAGE_KEY, payload)
  } catch {
    return false
  }
}

/** File-safe JSON for one draft or a whole set. */
export function serializeDraftExport (drafts, { now = Date.now() } = {}) {
  const list = (Array.isArray(drafts) ? drafts : [drafts])
    .filter(Boolean)
    .map(item => normalizeDraft(item, now))
  return JSON.stringify({
    app: 'hive.ausbit.dev',
    type: DRAFT_EXPORT_TYPE,
    version: DRAFT_VERSION,
    exportedAt: new Date(now).toISOString(),
    drafts: list
  }, null, 2)
}

/** Parse a draft export file. Accepts our envelope, a bare array or one draft. */
export function parseDraftExport (text, { now = Date.now(), owner = null } = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    return { drafts: [], skipped: 0, error: 'The file is empty.' }
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { drafts: [], skipped: 0, error: 'This file is not valid JSON.' }
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed && parsed.drafts)
      ? parsed.drafts
      : parsed && typeof parsed === 'object'
        ? [parsed]
        : []

  const candidates = list.filter(item => item && typeof item === 'object')
  if (!candidates.length) {
    return { drafts: [], skipped: 0, error: 'No drafts were found in this file.' }
  }

  const drafts = []
  let skipped = 0
  for (const item of candidates) {
    const draft = normalizeDraft({ ...item, owner: item.owner || owner || null }, now)
    if (!draftHasContent(draft)) {
      skipped += 1
      continue
    }
    drafts.push(draft)
  }

  if (!drafts.length) {
    return { drafts: [], skipped, error: 'No drafts with content were found in this file.' }
  }

  return { drafts, skipped, error: '' }
}

/**
 * Merge imported drafts without silently overwriting newer local work. Local
 * drafts win when they are newer than the imported copy.
 */
export function mergeImportedDrafts (existing, imported, { owner = null, now = Date.now() } = {}) {
  let drafts = Array.isArray(existing) ? [...existing] : []
  let added = 0
  let updated = 0
  let skipped = 0

  for (const raw of Array.isArray(imported) ? imported : []) {
    const draft = normalizeDraft({ ...raw, owner: raw.owner || owner || null }, now)
    if (!draftHasContent(draft)) {
      skipped += 1
      continue
    }
    const index = drafts.findIndex(item => item.id === draft.id)
    if (index === -1) {
      drafts.push(draft)
      added += 1
    } else if (draft.updatedAt >= Number(drafts[index].updatedAt)) {
      drafts[index] = draft
      updated += 1
    } else {
      skipped += 1
    }
  }

  drafts = sortDrafts(drafts).slice(0, MAX_DRAFTS)
  return { drafts, added, updated, skipped }
}

/** A short, readable file name for a draft export. */
export function draftExportFileName (draft) {
  const base = draftDisplayTitle(draft)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'draft'
  return base + '.hive-draft.json'
}
