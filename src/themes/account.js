// Reading and writing the namespaced profile theme in Hive account metadata.
//
// The canonical location is a top-level `"hive.ausbit.dev"` key inside
// `posting_json_metadata`. It is deliberately not under `profile` or
// `extensions`: apps that only understand the standard profile fields are more
// likely to preserve an unknown top-level key than to preserve unknown nested
// keys. Every write is a read-merge-write of the whole object and every
// untouched account field is sent back unchanged.

import { safeJsonParse } from '../utils/safeHtml'
import { validateTheme, THEME_SCHEMA } from './schema'

export const THEME_NAMESPACE = 'hive.ausbit.dev'
// Account metadata can already be a few kilobytes. The theme itself is capped
// at MAX_THEME_BYTES; leave room for the profile without rejecting every
// account that has a long bio or a few social links.
export const MAX_POSTING_METADATA_BYTES = 16000

export function parsePostingMetadata (raw) {
  const parsed = safeJsonParse(raw, null)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, value: {}, error: 'posting_json_metadata is not a JSON object' }
  }
  return { ok: true, value: parsed, error: '' }
}

export function themeFromPostingMetadata (raw) {
  const parsed = parsePostingMetadata(raw)
  if (!parsed.ok) return { theme: null, error: parsed.error, raw: parsed.value }
  const namespace = parsed.value[THEME_NAMESPACE]
  const candidate = namespace && typeof namespace === 'object' ? namespace.theme : null
  if (!candidate) return { theme: null, error: '', raw: parsed.value }
  const result = validateTheme(candidate, { requireProfile: true })
  return {
    theme: result.theme,
    error: result.errors[0] || '',
    warnings: result.warnings,
    legacy: result.legacy,
    raw: parsed.value
  }
}

export function readAccountTheme (account) {
  if (!account) return { theme: null, error: 'Account is not loaded', raw: {} }
  return themeFromPostingMetadata(account.posting_json_metadata)
}

function cloneJson (value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Merge a validated theme into an existing posting_json_metadata string.
 *
 * @returns {{ ok: boolean, text: string, value: object|null, previous: object|null, error: string }}
 */
export function mergeThemeMetadata (raw, theme) {
  const parsed = parsePostingMetadata(raw)
  if (!parsed.ok) {
    return { ok: false, text: '', value: null, previous: null, error: parsed.error }
  }
  if (!theme || theme.schema !== THEME_SCHEMA) {
    return { ok: false, text: '', value: null, previous: null, error: 'Theme is not valid' }
  }

  const value = cloneJson(parsed.value)
  const previous = value[THEME_NAMESPACE] && typeof value[THEME_NAMESPACE] === 'object'
    ? cloneJson(value[THEME_NAMESPACE])
    : null
  value[THEME_NAMESPACE] = {
    ...(previous || {}),
    theme: cloneJson(theme)
  }
  const text = JSON.stringify(value)
  if (text.length > MAX_POSTING_METADATA_BYTES) {
    return { ok: false, text: '', value: null, previous, error: 'The merged profile metadata is too large' }
  }
  return { ok: true, text, value, previous, error: '' }
}

export function removeThemeMetadata (raw) {
  const parsed = parsePostingMetadata(raw)
  if (!parsed.ok) {
    return { ok: false, text: '', value: null, error: parsed.error }
  }
  const value = cloneJson(parsed.value)
  if (value[THEME_NAMESPACE] && typeof value[THEME_NAMESPACE] === 'object') {
    delete value[THEME_NAMESPACE].theme
    if (Object.keys(value[THEME_NAMESPACE]).length === 0) delete value[THEME_NAMESPACE]
  }
  return { ok: true, text: JSON.stringify(value), value, error: '' }
}

/**
 * Build the account_update2 operation.
 *
 * `account_update2` lets the posting authority update `posting_json_metadata`
 * when owner/active/posting authorities and the memo key are omitted. The
 * legacy `json_metadata` field must be an empty string: in Hive, empty means
 * "leave this field unchanged" and a non-empty value would escalate the
 * operation to active authority. hive-tx serialises the field as a required
 * string, so an empty string is both safe and necessary here.
 */
export function buildThemeOperation (account, mergedPostingMetadata) {
  return ['account_update2', {
    account: account.name,
    json_metadata: '',
    posting_json_metadata: mergedPostingMetadata,
    extensions: []
  }]
}

export function metadataSize (value) {
  try {
    return JSON.stringify(value).length
  } catch {
    return 0
  }
}

export function themeNamespaceSize (theme) {
  return metadataSize({ [THEME_NAMESPACE]: { theme } })
}

/** Extract a theme from a share code or a pasted JSON object. */
export function themeFromShareValue (value) {
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      return validateTheme(JSON.parse(value), { requireProfile: true })
    } catch {
      return { ok: false, theme: null, errors: ['Theme is not valid JSON'], warnings: [] }
    }
  }
  return { ok: false, theme: null, errors: ['Theme source is not recognised'], warnings: [] }
}
