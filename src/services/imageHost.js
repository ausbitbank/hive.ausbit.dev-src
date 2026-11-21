// Image uploads for the composer.
//
// Uploading to images.hive.blog requires a signature over
// sha256("ImageSigningChallenge" + file). The signature is produced by
// Keychain or SmartLock; this module never sees a private key.

import { safeExternalUrl } from '../utils/safeUrl'

export const IMAGE_HOST = 'https://images.hive.blog'
export const IMAGE_SIGNING_CHALLENGE = 'ImageSigningChallenge'
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const RECOMMENDED_IMAGE_BYTES = 4 * 1024 * 1024
export const MAX_UPLOAD_HISTORY = 24

export const UPLOAD_HISTORY_PREFIX = 'composeUploads:'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
  'image/bmp'
])

const ALLOWED_EXTENSIONS = /\.(?:jpe?g|png|gif|webp|svg|avif|bmp)$/i
const REJECTED_EXTENSIONS = /\.(?:heic|heif)$/i
const ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/

function fileExtension (file) {
  const name = String(file?.name || '')
  const match = name.match(/\.[a-z0-9]+$/i)
  return match ? match[0].toLowerCase() : ''
}

export function validateImageFile (file, { maxBytes = MAX_IMAGE_BYTES } = {}) {
  if (!file) return { ok: false, error: 'Choose an image first.' }
  const name = String(file.name || 'image')
  const type = String(file.type || '').toLowerCase()
  const size = Number(file.size || 0)

  if (REJECTED_EXTENSIONS.test(name) || /hei[cf]/i.test(type)) {
    return { ok: false, error: 'HEIC/HEIF photos need converting to JPEG before upload.' }
  }
  if (type && !ALLOWED_TYPES.has(type) && !type.startsWith('image/')) {
    return { ok: false, error: 'That file is not an image.' }
  }
  if (!type && !ALLOWED_EXTENSIONS.test(name)) {
    return { ok: false, error: 'Use a JPEG, PNG, GIF, WebP, AVIF, BMP or SVG image.' }
  }
  if (size <= 0) return { ok: false, error: 'That file is empty.' }
  if (size > maxBytes) {
    return {
      ok: false,
      error: 'Images are limited to ' + Math.round(maxBytes / (1024 * 1024)) + ' MB.'
    }
  }
  return { ok: true, type: type || 'image', extension: fileExtension(file) }
}

export function buildImageSigningPayload (bytes) {
  const challenge = new TextEncoder().encode(IMAGE_SIGNING_CHALLENGE)
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || [])
  const combined = new Uint8Array(challenge.length + source.length)
  combined.set(challenge, 0)
  combined.set(source, challenge.length)
  // Keychain and SmartLock both understand the standard Buffer JSON shape.
  return JSON.stringify({ type: 'Buffer', data: Array.from(combined) })
}

export async function readImageBytes (file) {
  if (!file) throw new Error('Choose an image first.')
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer())
  }
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('This browser cannot read the selected image.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (result instanceof ArrayBuffer) resolve(new Uint8Array(result))
      else reject(new Error('This browser cannot read the selected image.'))
    }
    reader.onerror = () => reject(new Error('Could not read the selected image.'))
    reader.readAsArrayBuffer(file)
  })
}

export function imageUploadUrl (username, signature) {
  const account = String(username || '').trim().toLowerCase()
  const sig = String(signature || '').trim()
  if (!ACCOUNT_RE.test(account)) throw new Error('A valid Hive account is required to upload.')
  if (!sig) throw new Error('The upload signature is missing.')
  return IMAGE_HOST + '/' + encodeURIComponent(account) + '/' + encodeURIComponent(sig)
}

function errorFromResponse (status, data) {
  const error = new Error(
    data?.error?.name ||
    data?.message ||
    'The image host rejected the upload (HTTP ' + status + ').'
  )
  error.code = data?.error?.name || 'upload_failed'
  error.info = data?.error?.info || null
  error.status = status
  return error
}

export function imageHostErrorMessage (error) {
  const code = String(error?.code || '').toLowerCase()
  if (code.includes('signature')) return 'The image host rejected the signature. Try signing in again and retry.'
  if (code.includes('rate') || code.includes('limit')) return 'The image host rate limit was reached. Try again later.'
  if (code.includes('size') || code.includes('large')) return 'That image is too large for the image host.'
  if (code.includes('type') || code.includes('format')) return 'The image host does not support that image format.'
  if (code.includes('reputation')) return 'This account does not meet the image host reputation requirement.'
  return error?.message || 'The upload failed. Try again.'
}

/**
 * Upload one image. `signature` is the posting-key signature over the signed
 * challenge payload. Returns the public image URL.
 */
export async function uploadImage ({ username, signature, file, fetchImpl = fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Uploads are not available in this browser.')
  const validation = validateImageFile(file)
  if (!validation.ok) throw new Error(validation.error)

  const url = imageUploadUrl(username, signature)
  const form = new FormData()
  form.append('file', file, file.name || 'image')

  let response
  try {
    response = await fetchImpl(url, { method: 'POST', body: form })
  } catch (error) {
    const wrapped = new Error('Could not reach the image host. Check your connection and retry.')
    wrapped.cause = error
    throw wrapped
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON error pages still produce the HTTP status below.
  }

  if (!response.ok) throw errorFromResponse(response.status, data)
  const uploaded = safeExternalUrl(data?.url)
  if (!uploaded) throw new Error('The image host returned an invalid URL.')
  return uploaded
}

function historyKey (owner) {
  const account = String(owner || '').trim().toLowerCase()
  return UPLOAD_HISTORY_PREFIX + (ACCOUNT_RE.test(account) ? account : 'guest')
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
    // Ignore storage failures; history is a convenience, not a draft.
  }
}

function parseHistory (raw) {
  if (!raw) return []
  if (typeof raw === 'object') return Array.isArray(raw.items) ? raw.items : []
  try {
    const parsed = JSON.parse(String(raw).replace(/^__q_objt\|/, ''))
    return Array.isArray(parsed?.items) ? parsed.items : []
  } catch {
    return []
  }
}

function normalizeHistoryEntry (entry) {
  const url = safeExternalUrl(entry?.url)
  if (!url) return null
  return {
    url,
    alt: String(entry?.alt || '').slice(0, 200),
    name: String(entry?.name || '').slice(0, 200),
    size: Number(entry?.size) || 0,
    type: String(entry?.type || '').slice(0, 80),
    uploadedAt: Number(entry?.uploadedAt) || Date.now()
  }
}

export function readUploadHistory (storage, owner = null) {
  return parseHistory(storageGet(storage, historyKey(owner)))
    .map(normalizeHistoryEntry)
    .filter(Boolean)
    .sort((a, b) => b.uploadedAt - a.uploadedAt)
    .slice(0, MAX_UPLOAD_HISTORY)
}

export function appendUploadHistory (storage, owner, entry, now = Date.now()) {
  const normalized = normalizeHistoryEntry({ ...entry, uploadedAt: entry?.uploadedAt || now })
  if (!normalized) return readUploadHistory(storage, owner)
  const list = [
    normalized,
    ...readUploadHistory(storage, owner).filter(item => item.url !== normalized.url)
  ].slice(0, MAX_UPLOAD_HISTORY)
  storageSet(storage, historyKey(owner), { version: 1, items: list })
  return list
}

export function clearUploadHistory (storage, owner = null) {
  storageRemove(storage, historyKey(owner))
  return []
}
