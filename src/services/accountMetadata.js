// Pure helpers for editing Hive account JSON metadata.
//
// `json_metadata` and `posting_json_metadata` are JSON strings on chain. A
// freshly created account has both as empty strings, so callers must treat
// "empty" as "{}" rather than calling JSON.parse('') and crashing.
//
// `posting_json_metadata` is the canonical place for profile fields
// (`profile.profile_image`, `profile.cover_image`, …) and is writable with the
// posting key through `account_update2`. The legacy `json_metadata` field is
// still shown so accounts can fix it, but writing it needs the active key.

export const MAX_ACCOUNT_METADATA_BYTES = 16000

function isPlainObject (value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function clone (value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Parse metadata from chain (string) or from a caller (object).
 *
 * @returns {{ ok: boolean, value: object, empty: boolean, error: string }}
 */
export function parseAccountMetadata (raw) {
  if (raw === null || raw === undefined) {
    return { ok: true, value: {}, empty: true, error: '' }
  }
  if (typeof raw === 'object') {
    if (!isPlainObject(raw)) {
      return { ok: false, value: {}, empty: false, error: 'Account metadata must be a JSON object.' }
    }
    return { ok: true, value: clone(raw), empty: Object.keys(raw).length === 0, error: '' }
  }

  const text = String(raw).trim()
  if (!text) return { ok: true, value: {}, empty: true, error: '' }

  try {
    const parsed = JSON.parse(text)
    if (!isPlainObject(parsed)) {
      return { ok: false, value: {}, empty: false, error: 'Account metadata must be a JSON object.' }
    }
    return { ok: true, value: parsed, empty: Object.keys(parsed).length === 0, error: '' }
  } catch {
    return { ok: false, value: {}, empty: false, error: 'Account metadata is not valid JSON.' }
  }
}

/** Pretty text for the editor textarea. */
export function formatAccountMetadata (value) {
  return JSON.stringify(isPlainObject(value) ? value : {}, null, 2)
}

/** Stable text for dirty checks; formatting does not count as a change. */
export function canonicalAccountMetadata (value) {
  return JSON.stringify(isPlainObject(value) ? value : {})
}

export function accountMetadataSize (value) {
  if (!isPlainObject(value)) return 0
  const text = canonicalAccountMetadata(value)
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length
  return text.length
}

export function profileFromMetadata (value) {
  return isPlainObject(value?.profile) ? value.profile : {}
}

export function hasProfileField (value, key) {
  const profile = profileFromMetadata(value)
  return Object.prototype.hasOwnProperty.call(profile, key)
}

/** Return a copy with `profile[key]` set. Creates `profile` when absent. */
export function setProfileField (value, key, fieldValue) {
  const next = isPlainObject(value) ? clone(value) : {}
  const profile = isPlainObject(next.profile) ? next.profile : {}
  profile[key] = fieldValue
  next.profile = profile
  return next
}

/** Return a copy with `profile[key]` removed; drops an empty `profile`. */
export function removeProfileField (value, key) {
  const next = isPlainObject(value) ? clone(value) : {}
  if (!isPlainObject(next.profile)) return next
  delete next.profile[key]
  if (Object.keys(next.profile).length === 0) delete next.profile
  return next
}

/**
 * `account_update2` with the posting key. Hive treats an empty legacy
 * `json_metadata` as "leave unchanged"; echoing it back would escalate the
 * operation to active authority.
 */
export function buildPostingMetadataOperation (accountName, postingMetadata) {
  return ['account_update2', {
    account: accountName,
    json_metadata: '',
    posting_json_metadata: postingMetadata,
    extensions: []
  }]
}

/**
 * Legacy `account_update` needs the active key and echoes the current posting
 * authority + memo key so they stay unchanged.
 */
export function buildLegacyMetadataOperation (account, jsonMetadata) {
  if (!account?.name || !account?.posting || !account?.memo_key) return null
  return ['account_update', {
    account: account.name,
    posting: account.posting,
    memo_key: account.memo_key,
    json_metadata: jsonMetadata
  }]
}
