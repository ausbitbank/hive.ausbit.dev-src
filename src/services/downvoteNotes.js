// Local, private notes attached to a downvote row.
//
// The chain has no reason field, so the author's own record of what happened
// is valuable. Notes never leave the device and are scoped to the signed-in
// account (guests get their own bucket).

import { LocalStorage } from 'quasar'

export const NOTE_TAGS = [
  'no reason given',
  'spam accusation',
  'policy dispute',
  'retaliation',
  'asked why',
  'off-topic',
  'other'
]

export const MAX_NOTE_LENGTH = 4000
export const MAX_NOTE_TAGS = 6
const KEY_PREFIX = 'banksia:downvote-notes:v1:'

function keyFor (scope) {
  return KEY_PREFIX + String(scope || 'guest').toLowerCase()
}

function normalizeTags (tags) {
  const seen = new Set()
  const out = []
  for (const tag of Array.isArray(tags) ? tags : []) {
    const value = String(tag || '').trim().slice(0, 60)
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
    if (out.length >= MAX_NOTE_TAGS) break
  }
  return out
}

function normalizeNote (value) {
  if (!value || typeof value !== 'object') return null
  const note = String(value.note || '').trim().slice(0, MAX_NOTE_LENGTH)
  const tags = normalizeTags(value.tags)
  if (!note && !tags.length) return null
  return {
    note,
    tags,
    updatedAt: value.updatedAt || new Date().toISOString()
  }
}

/** Read all notes for a scope. Corrupt or missing storage is an empty map. */
export function loadNotes (scope = 'guest') {
  try {
    const raw = LocalStorage.getItem(keyFor(scope))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out = {}
    for (const [rowKey, value] of Object.entries(parsed)) {
      const note = normalizeNote(value)
      if (rowKey && note) out[rowKey] = note
    }
    return out
  } catch {
    return {}
  }
}

function persist (scope, notes) {
  try {
    if (!notes || !Object.keys(notes).length) {
      LocalStorage.remove(keyFor(scope))
      return
    }
    LocalStorage.set(keyFor(scope), JSON.stringify(notes))
  } catch {
    // Quota/private-mode failures leave the in-memory copy usable.
  }
}

/** Save or replace a row note. An empty note and no tags removes it. */
export function saveNote (scope, rowKey, { note = '', tags = [] } = {}) {
  const notes = loadNotes(scope)
  const key = String(rowKey || '')
  if (!key) return notes
  const normalized = normalizeNote({ note, tags })
  if (normalized) notes[key] = normalized
  else delete notes[key]
  persist(scope, notes)
  return notes
}

export function removeNote (scope, rowKey) {
  const notes = loadNotes(scope)
  delete notes[String(rowKey || '')]
  persist(scope, notes)
  return notes
}

export function noteFor (notes, rowKey) {
  return (notes && notes[String(rowKey || '')]) || null
}

/** Count notes and supported tags for a summary badge. */
export function notesSummary (notes) {
  const list = Object.values(notes || {})
  const tags = {}
  for (const note of list) {
    for (const tag of note.tags || []) tags[tag] = (tags[tag] || 0) + 1
  }
  return { count: list.length, tags }
}
