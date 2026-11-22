// Compact, URL-safe theme codes.
//
// A code is a validated theme, never CSS. Export prefers gzip through the
// platform CompressionStream and falls back to plain JSON. Import always
// validates before the caller is allowed to preview or apply it.

import { MAX_THEME_BYTES, validateTheme } from './schema'

export const CODE_PREFIX = 'hive-theme:1:'
export const MAX_CODE_LENGTH = 14000

function bytesToBase64Url (bytes) {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes (value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function gzip (bytes) {
  if (typeof CompressionStream !== 'function') return null
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

async function gunzip (bytes) {
  if (typeof DecompressionStream !== 'function') return null
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

/**
 * Encode a validated theme. Returns `hive-theme:1:g:<base64url>` when gzip is
 * available, otherwise `hive-theme:1:j:<base64url>`.
 */
export async function encodeThemeCode (theme) {
  if (!theme || typeof theme !== 'object') throw new Error('Theme is not valid')
  const json = JSON.stringify(theme)
  if (json.length > MAX_THEME_BYTES) throw new Error('Theme is too large to share')
  const bytes = new TextEncoder().encode(json)
  const compressed = await gzip(bytes)
  if (compressed && compressed.length < bytes.length) {
    return CODE_PREFIX + 'g:' + bytesToBase64Url(compressed)
  }
  return CODE_PREFIX + 'j:' + bytesToBase64Url(bytes)
}

/** Decode and validate a theme code without ever throwing at the caller. */
export async function decodeThemeCode (value) {
  const code = typeof value === 'string' ? value.trim() : ''
  if (!code) return { ok: false, theme: null, errors: ['Paste a theme code first'], warnings: [] }
  if (code.length > MAX_CODE_LENGTH) return { ok: false, theme: null, errors: ['Theme code is too long'], warnings: [] }
  if (!code.startsWith(CODE_PREFIX)) {
    return { ok: false, theme: null, errors: ['That is not a Hive theme code'], warnings: [] }
  }
  const body = code.slice(CODE_PREFIX.length)
  const marker = body.slice(0, 2)
  if (marker !== 'g:' && marker !== 'j:') {
    return { ok: false, theme: null, errors: ['Theme code has an unknown format'], warnings: [] }
  }
  let bytes
  try {
    bytes = base64UrlToBytes(body.slice(2))
  } catch {
    return { ok: false, theme: null, errors: ['Theme code is not valid base64'], warnings: [] }
  }
  if (marker === 'g:') {
    const decoded = await gunzip(bytes)
    if (!decoded) return { ok: false, theme: null, errors: ['This browser cannot read compressed theme codes'], warnings: [] }
    bytes = decoded
  }
  if (bytes.length > MAX_THEME_BYTES) {
    return { ok: false, theme: null, errors: ['Theme code is too large'], warnings: [] }
  }
  let parsed
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return { ok: false, theme: null, errors: ['Theme code is not valid JSON'], warnings: [] }
  }
  return validateTheme(parsed)
}
