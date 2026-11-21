// Local draft storage for the creator workflow.
//
// Drafts are content-only and never contain keys. They live in localStorage
// behind a small pure API so autosave, export/import and tests share the same
// normalisation and quota handling.

import { byteLength, readingMinutes, wordCount } from '../utils/markdownEditor'
import { safeExternalUrl } from '../utils/safeUrl'

export const DRAFT_STORAGE_KEY = 'composeDrafts'
export const DRAFT_EXPORT_TYPE = 'hive-drafts'
export const DRAFT_VERSION = 3
export const MAX_DRAFTS = 40
export const MAX_TITLE_CHARS = 255
export const MAX_BODY_BYTES = 65535
export const MAX_TAGS = 10
export const MAX_BENEFICIARIES = 8
export const DESCRIPTION_MAX = 160
export const AUTHOR_DISPLAY_MAX = 80
export const COLLECTION_TAG = 'c-c-c'

export const AI_TOOL_KEYS = [
  'media_generation',
  'translation',
  'post_draft',
  'writing_edit',
  'research',
  'other'
]

const ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/
const TAG_RE = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/
const ZERO_PAYOUT_RE = /^0(?:\.0+)?\s*(?:HBD)?$/i

export const MAX_ACCEPTED_PAYOUT = '100000.000 HBD'

export function defaultRewards () {
  return {
    maxAcceptedPayout: MAX_ACCEPTED_PAYOUT,
    percentHbd: 10000,
    allowVotes: true,
    allowCurationRewards: true,
    decline: false
  }
}

export function defaultAiTools () {
  return {
    media_generation: false,
    translation: false,
    post_draft: false,
    writing_edit: false,
    research: false,
    other: false
  }
}

function cleanString (value, maxLength = 100000) {
  if (value === null || value === undefined) return ''
  return String(value).slice(0, maxLength)
}

export function normalizeAiTools (value) {
  const source = value && typeof value === 'object' ? value : {}
  return AI_TOOL_KEYS.reduce((tools, key) => {
    tools[key] = source[key] === true
    return tools
  }, {})
}

export function hasAiTools (value) {
  return AI_TOOL_KEYS.some(key => Boolean(value && value[key]))
}

export function normalizeDescription (value) {
  return cleanString(value, DESCRIPTION_MAX).replace(/\s+/g, ' ').trim()
}

export function normalizeCoverImage (value) {
  return safeExternalUrl(cleanString(value, 2000)) || ''
}

export function normalizeCountdown (value) {
  const text = cleanString(value, 60).trim()
  if (!text) return ''
  const time = Date.parse(text)
  return Number.isFinite(time) ? new Date(time).toISOString() : ''
}

/** Local publish reminder. Past values are kept so a due reminder can surface. */
export function normalizeScheduledAt (value) {
  return normalizeCountdown(value)
}

export function normalizeArchivedAt (value) {
  const time = Number(value)
  return Number.isFinite(time) && time > 0 ? time : null
}

export function normalizeAuthorDisplay (value) {
  return cleanString(value, AUTHOR_DISPLAY_MAX).replace(/\s+/g, ' ').trim()
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

/**
 * The published post a draft is editing. Keeping this on the draft means a
 * reload of `/compose?edit=…` still produces an edit rather than a new post.
 */
export function normalizeEditing (value, editedBy = null) {
  if (!value || typeof value !== 'object') return null
  const author = cleanString(value.author, 16).trim().toLowerCase()
  const permlink = cleanString(value.permlink, 255).trim().toLowerCase()
  if (!ACCOUNT_RE.test(author)) return null
  if (!/^[a-z0-9][a-z0-9-]{0,254}$/.test(permlink)) return null
  // Never let a draft edit someone else's post.
  if (editedBy && ACCOUNT_RE.test(editedBy) && editedBy !== author) return null
  const metadata = value.previousMetadata && typeof value.previousMetadata === 'object'
    ? value.previousMetadata
    : null
  return {
    author,
    permlink,
    parentAuthor: typeof value.parentAuthor === 'string' && ACCOUNT_RE.test(value.parentAuthor.trim().toLowerCase())
      ? value.parentAuthor.trim().toLowerCase()
      : '',
    parentPermlink: normalizeTag(value.parentPermlink) || normalizeTag(metadata && metadata.tags && metadata.tags[0]) || '',
    previousMetadata: metadata
  }
}

export function normalizeRewards (value) {
  const rewards = value && typeof value === 'object' ? value : {}
  const percent = Number(rewards.percentHbd)
  const maxAcceptedPayout = cleanString(rewards.maxAcceptedPayout, 40).trim() || MAX_ACCEPTED_PAYOUT
  return {
    maxAcceptedPayout,
    percentHbd: Number.isFinite(percent) ? Math.min(10000, Math.max(0, Math.round(percent))) : 10000,
    allowVotes: rewards.allowVotes !== false,
    allowCurationRewards: rewards.allowCurationRewards !== false,
    // A zero payout cap means rewards are declined. Keep the two in sync so a
    // draft written by an older version still opens in the right state.
    decline: rewards.decline === true || ZERO_PAYOUT_RE.test(maxAcceptedPayout)
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
    description: normalizeDescription(source.description),
    coverImage: normalizeCoverImage(source.coverImage),
    tags: normalizeTags(source.tags),
    community: normalizeTag(source.community),
    crossPost: normalizeCrossPost(source.crossPost),
    editing: normalizeEditing(source.editing, typeof source.owner === 'string' ? source.owner : null),
    beneficiaries: normalizeBeneficiaries(source.beneficiaries),
    rewards: normalizeRewards(source.rewards),
    aiTools: normalizeAiTools(source.aiTools),
    countdown: normalizeCountdown(source.countdown),
    portfolio: source.portfolio === true,
    collection: source.collection === true,
    authorDisplay: normalizeAuthorDisplay(source.authorDisplay),
    scheduledAt: normalizeScheduledAt(source.scheduledAt),
    archivedAt: normalizeArchivedAt(source.archivedAt),
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

export const PINNED_STORAGE_PREFIX = 'composePinned:'

function pinnedKey (owner) {
  const account = String(owner || '').trim().toLowerCase()
  return PINNED_STORAGE_PREFIX + (ACCOUNT_RE.test(account) ? account : 'guest')
}

function parsePinned (raw) {
  if (!raw) return []
  let list = []
  if (typeof raw === 'object') {
    list = Array.isArray(raw.ids) ? raw.ids : []
  } else {
    try {
      const parsed = JSON.parse(String(raw).replace(/^__q_objt\|/, ''))
      list = Array.isArray(parsed?.ids) ? parsed.ids : []
    } catch {
      // Keep the empty default.
    }
  }
  return [...new Set(list.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))]
}

export function readPinnedDraftIds (storage, owner = null) {
  return parsePinned(storageGet(storage, pinnedKey(owner)))
}

export function writePinnedDraftIds (storage, owner, ids) {
  const list = [...new Set((Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && id.trim()))]
  if (!list.length) {
    storageRemove(storage, pinnedKey(owner))
    return true
  }
  return storageSet(storage, pinnedKey(owner), { version: 1, ids: list })
}

export function togglePinnedDraftId (storage, owner, id) {
  const list = readPinnedDraftIds(storage, owner)
  const next = list.includes(id) ? list.filter(item => item !== id) : [id, ...list]
  writePinnedDraftIds(storage, owner, next)
  return next
}

export const DRAFT_HISTORY_KEY = 'composeDraftHistory'
export const DRAFT_HISTORY_VERSION = 1
export const MAX_DRAFT_HISTORY = 2
export const MAX_DRAFT_HISTORY_TOTAL = 20
export const DRAFT_HISTORY_INTERVAL_MS = 10 * 60 * 1000

function snapshotFields (draft) {
  return {
    title: draft.title,
    body: draft.body,
    description: draft.description,
    coverImage: draft.coverImage,
    tags: draft.tags,
    community: draft.community,
    crossPost: draft.crossPost,
    beneficiaries: draft.beneficiaries,
    rewards: draft.rewards,
    aiTools: draft.aiTools,
    countdown: draft.countdown,
    portfolio: draft.portfolio,
    collection: draft.collection,
    authorDisplay: draft.authorDisplay,
    scheduledAt: draft.scheduledAt
  }
}

function historySignature (draft) {
  return JSON.stringify(snapshotFields(normalizeDraft(draft)))
}

function normalizeHistorySnapshot (raw) {
  if (!raw || typeof raw !== 'object') return null
  const draftId = cleanString(raw.draftId, 80).trim()
  if (!draftId) return null
  const content = normalizeDraft({ ...raw, id: draftId }, Number(raw.capturedAt) || Date.now())
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 80) : 'snap-' + draftId + '-' + (Number(raw.capturedAt) || Date.now()),
    draftId,
    ...snapshotFields(content),
    updatedAt: content.updatedAt,
    capturedAt: Number(raw.capturedAt) || Date.now()
  }
}

function parseDraftHistory (raw) {
  if (!raw) return {}
  let source = raw
  if (typeof raw === 'string') {
    try {
      source = JSON.parse(String(raw).replace(/^__q_objt\|/, ''))
    } catch {
      return {}
    }
  }
  const drafts = source && typeof source === 'object' && source.drafts && typeof source.drafts === 'object'
    ? source.drafts
    : {}
  const out = {}
  for (const [draftId, list] of Object.entries(drafts)) {
    const snapshots = (Array.isArray(list) ? list : [])
      .map(normalizeHistorySnapshot)
      .filter(Boolean)
      .sort((a, b) => b.capturedAt - a.capturedAt)
      .slice(0, MAX_DRAFT_HISTORY)
    if (snapshots.length) out[draftId] = snapshots
  }
  return out
}

export function readDraftHistory (storage) {
  return parseDraftHistory(storageGet(storage, DRAFT_HISTORY_KEY))
}

function writeDraftHistory (storage, history) {
  const compact = {}
  let total = 0
  const entries = Object.entries(history || {})
    .flatMap(([draftId, list]) => (Array.isArray(list) ? list : []).map(snapshot => ({ draftId, snapshot })))
    .sort((a, b) => b.snapshot.capturedAt - a.snapshot.capturedAt)
  for (const entry of entries) {
    if (total >= MAX_DRAFT_HISTORY_TOTAL) break
    const list = compact[entry.draftId] || []
    if (list.length >= MAX_DRAFT_HISTORY) continue
    list.push(entry.snapshot)
    compact[entry.draftId] = list
    total += 1
  }
  if (!total) {
    storageRemove(storage, DRAFT_HISTORY_KEY)
    return true
  }
  return storageSet(storage, DRAFT_HISTORY_KEY, {
    version: DRAFT_HISTORY_VERSION,
    drafts: compact
  })
}

/**
 * Store the previous saved version of a draft before it is overwritten.
 * Autosave snapshots are throttled; explicit saves force one. History is a
 * recovery convenience, so a storage failure is ignored.
 */
export function appendDraftHistory (storage, previous, { now = Date.now(), force = false, current = null } = {}) {
  if (!previous || !previous.id) return readDraftHistory(storage)
  const history = readDraftHistory(storage)
  const list = history[previous.id] || []
  if (current && historySignature(previous) === historySignature(current)) return history
  if (list[0] && historySignature(list[0]) === historySignature(previous)) return history
  if (!force && list[0] && now - list[0].capturedAt < DRAFT_HISTORY_INTERVAL_MS) return history

  const normalized = normalizeDraft(previous, now)
  const snapshot = {
    id: 'snap-' + previous.id + '-' + now,
    draftId: previous.id,
    ...snapshotFields(normalized),
    updatedAt: normalized.updatedAt,
    capturedAt: now
  }
  const next = {
    ...history,
    [previous.id]: [snapshot, ...list].slice(0, MAX_DRAFT_HISTORY)
  }
  writeDraftHistory(storage, next)
  return readDraftHistory(storage)
}

export function removeDraftHistory (storage, draftId) {
  if (!draftId) return readDraftHistory(storage)
  const history = readDraftHistory(storage)
  if (!history[draftId]) return history
  delete history[draftId]
  writeDraftHistory(storage, history)
  return readDraftHistory(storage)
}

export function clearDraftHistory (storage) {
  storageRemove(storage, DRAFT_HISTORY_KEY)
  return {}
}

/** Restore a snapshot while keeping the draft's id, owner and edit identity. */
export function restoreDraftSnapshot (snapshot, draft, now = Date.now()) {
  const base = normalizeDraft(draft, now)
  const content = snapshotFields(normalizeDraft(snapshot, now))
  return normalizeDraft({
    ...base,
    ...content,
    id: base.id,
    owner: base.owner,
    editing: base.editing,
    createdAt: base.createdAt,
    updatedAt: now
  }, now)
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
