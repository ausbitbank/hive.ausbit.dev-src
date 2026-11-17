// Locally saved public witness signing keys.
//
// Only public keys are stored. They never leave the browser and are useful when
// one operator runs several nodes with different block-signing keys.
import { validateSigningKey } from './witnesses'

export const WITNESS_KEYS_STORAGE_KEY = 'witnessSigningKeys'
export const MAX_SAVED_KEYS = 20
export const MAX_LABEL_LENGTH = 40

function storageTarget (storage) {
  if (storage) return storage
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Private mode or blocked storage.
  }
  return null
}

export function saveSigningKeyLabel (label = '', maxLength = MAX_LABEL_LENGTH) {
  const trimmed = String(label || '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''
  return trimmed.slice(0, maxLength)
}

export function normalizeSavedKeys (keys) {
  const list = Array.isArray(keys) ? keys : []
  const seen = new Set()
  const normalized = []

  for (const item of list) {
    const key = String(item?.key || '').trim()
    if (!validateSigningKey(key) || seen.has(key)) continue
    seen.add(key)
    normalized.push({
      key,
      label: saveSigningKeyLabel(item.label) || shortSigningKey(key)
    })
    if (normalized.length >= MAX_SAVED_KEYS) break
  }

  return normalized
}

export function addSavedKey (keys, key, label) {
  const value = String(key || '').trim()
  if (!validateSigningKey(value)) return normalizeSavedKeys(keys)
  const nextLabel = saveSigningKeyLabel(label)
  if (!nextLabel) return normalizeSavedKeys(keys)

  const existing = normalizeSavedKeys(keys)
  const found = existing.find(item => item.key === value)
  if (found) {
    return existing.map(item => item.key === value ? { ...item, label: nextLabel } : item)
  }
  return [...existing, { key: value, label: nextLabel }].slice(0, MAX_SAVED_KEYS)
}

export function removeSavedKey (keys, key) {
  const value = String(key || '').trim()
  return normalizeSavedKeys(keys).filter(item => item.key !== value)
}

export function shortSigningKey (key, head = 8, tail = 6) {
  const value = String(key || '')
  if (value.length <= head + tail + 3) return value
  return value.slice(0, head) + '…' + value.slice(-tail)
}

export function loadSavedKeys (storage) {
  const target = storageTarget(storage)
  if (!target) return []
  try {
    return normalizeSavedKeys(JSON.parse(target.getItem(WITNESS_KEYS_STORAGE_KEY) || '[]'))
  } catch {
    return []
  }
}

export function saveSavedKeys (keys, storage) {
  const target = storageTarget(storage)
  if (!target) return false
  try {
    target.setItem(WITNESS_KEYS_STORAGE_KEY, JSON.stringify(normalizeSavedKeys(keys)))
    return true
  } catch {
    return false
  }
}
