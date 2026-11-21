// Image uploads for the composer.
//
// Uploading to images.hive.blog requires a signature over
// sha256("ImageSigningChallenge" + file). The signature is produced by
// Keychain, SmartLock or HiveAuth; this module never sees a private key.

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

/** Human-readable byte size, or an empty string for unknown/zero sizes. */
export function formatUploadBytes (bytes) {
  const size = Number(bytes)
  if (!Number.isFinite(size) || size <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const rounded = unit === 0 || value >= 10 ? Math.round(value) : value.toFixed(1)
  return rounded + ' ' + units[unit]
}

/** Compact relative time for recent uploads. Deterministic for tests. */
export function formatUploadAge (uploadedAt, now = Date.now()) {
  const time = Number(uploadedAt)
  if (!Number.isFinite(time) || time <= 0) return ''
  const minutes = Math.floor(Math.max(0, Number(now) - time) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return minutes + ' min ago'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago')
  const days = Math.floor(hours / 24)
  if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago')
  const months = Math.floor(days / 30)
  if (months < 12) return months + (months === 1 ? ' month ago' : ' months ago')
  const years = Math.floor(days / 365)
  return years + (years === 1 ? ' year ago' : ' years ago')
}

/**
 * Build the local upload queue shown in the upload dialog. The File object stays
 * in component memory only; it is never serialised into a draft or local storage.
 */
export function createUploadQueue (files, { now = Date.now(), target = 'body' } = {}) {
  const list = Array.from(files || [])
  const visible = target === 'cover' ? list.slice(0, 1) : list
  return visible.map((file, index) => ({
    id: target + ':' + now + ':' + index + ':' + String(file?.name || 'image'),
    file,
    name: String(file?.name || 'image'),
    size: Number(file?.size) || 0,
    type: String(file?.type || ''),
    status: 'queued',
    progress: 0,
    error: '',
    url: '',
    alt: ''
  }))
}

/** Counts for the upload summary and the dialog's close/retry decisions. */
export function uploadQueueSummary (items) {
  const summary = {
    total: 0,
    queued: 0,
    signing: 0,
    uploading: 0,
    done: 0,
    failed: 0,
    cancelled: 0
  }
  for (const item of items || []) {
    summary.total += 1
    if (item?.status === 'queued') summary.queued += 1
    else if (item?.status === 'signing') summary.signing += 1
    else if (item?.status === 'uploading') summary.uploading += 1
    else if (item?.status === 'done') summary.done += 1
    else if (item?.status === 'error') summary.failed += 1
    else if (item?.status === 'cancelled') summary.cancelled += 1
  }
  summary.active = summary.queued + summary.signing + summary.uploading
  summary.finished = summary.active === 0
  return summary
}

export function isUploadAborted (error) {
  return error?.code === 'aborted' || error?.name === 'AbortError'
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

function parseResponseJson (text) {
  try {
    return JSON.parse(String(text || 'null'))
  } catch {
    return null
  }
}

function uploadWithXhr ({ url, file, onProgress, signal, xhrFactory }) {
  return new Promise((resolve, reject) => {
    let xhr
    try {
      xhr = xhrFactory ? xhrFactory() : new XMLHttpRequest()
    } catch {
      reject(new Error('Uploads are not available in this browser.'))
      return
    }
    if (!xhr || typeof xhr.open !== 'function') {
      reject(new Error('Uploads are not available in this browser.'))
      return
    }

    let settled = false
    const settle = (callback, value) => {
      if (settled) return
      settled = true
      if (signal) signal.removeEventListener('abort', abortUpload)
      callback(value)
    }
    const abortError = () => {
      const error = new Error('Upload cancelled.')
      error.code = 'aborted'
      error.name = 'AbortError'
      return error
    }
    function abortUpload () {
      try { xhr.abort() } catch { /* already closed */ }
      settle(reject, abortError())
    }

    if (signal?.aborted) {
      settle(reject, abortError())
      return
    }
    signal?.addEventListener('abort', abortUpload, { once: true })

    xhr.open('POST', url)
    if (typeof onProgress === 'function') {
      xhr.upload.onprogress = event => {
        if (!event?.lengthComputable || !event.total) return
        onProgress(Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100))))
      }
    }
    xhr.onerror = () => settle(reject, new Error('Could not reach the image host. Check your connection and retry.'))
    xhr.ontimeout = () => settle(reject, new Error('The image host timed out. Check your connection and retry.'))
    xhr.onabort = () => settle(reject, abortError())
    xhr.onload = () => {
      const data = parseResponseJson(xhr.responseText)
      if (xhr.status < 200 || xhr.status >= 300) {
        settle(reject, errorFromResponse(xhr.status, data))
        return
      }
      const uploaded = safeExternalUrl(data?.url)
      if (!uploaded) {
        settle(reject, new Error('The image host returned an invalid URL.'))
        return
      }
      if (typeof onProgress === 'function') onProgress(100)
      settle(resolve, uploaded)
    }

    const form = new FormData()
    form.append('file', file, file.name || 'image')
    try {
      xhr.send(form)
    } catch (error) {
      const wrapped = new Error('Could not reach the image host. Check your connection and retry.')
      wrapped.cause = error
      settle(reject, wrapped)
    }
  })
}

/**
 * Upload one image. `signature` is the posting-key signature over the signed
 * challenge payload. Returns the public image URL.
 *
 * Production uses XMLHttpRequest for upload progress and cancellation; passing
 * `fetchImpl` keeps the smaller fetch path for tests and non-browser callers.
 * Fetch does not expose upload progress, so it reports 0 then 100.
 */
export async function uploadImage ({
  username,
  signature,
  file,
  fetchImpl = null,
  xhrFactory = null,
  onProgress = null,
  signal = null
} = {}) {
  const validation = validateImageFile(file)
  if (!validation.ok) throw new Error(validation.error)
  if (signal?.aborted) {
    const error = new Error('Upload cancelled.')
    error.code = 'aborted'
    error.name = 'AbortError'
    throw error
  }

  const url = imageUploadUrl(username, signature)
  if (typeof onProgress === 'function') onProgress(0)

  if (typeof fetchImpl !== 'function') {
    return uploadWithXhr({ url, file, onProgress, signal, xhrFactory })
  }

  const form = new FormData()
  form.append('file', file, file.name || 'image')

  let response
  try {
    response = await fetchImpl(url, { method: 'POST', body: form, signal })
  } catch (error) {
    if (error?.name === 'AbortError' || signal?.aborted) {
      const aborted = new Error('Upload cancelled.')
      aborted.code = 'aborted'
      aborted.name = 'AbortError'
      throw aborted
    }
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
  if (typeof onProgress === 'function') onProgress(100)
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
