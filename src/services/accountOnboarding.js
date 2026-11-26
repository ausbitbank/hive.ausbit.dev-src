// Onboarding metadata shared by account creation and the post-signup prompt.
//
// `json_metadata` is the only metadata field available in the account creation
// operation. We keep it small and truthful: app + onboarding attribution. The
// canonical profile lives in `posting_json_metadata` and is set later by the
// account owner with their posting key.

import { isValidAccountName } from './hiveNames'

export const ONBOARDING_METADATA_VERSION = 1
export const DEFAULT_SPONSOR_BENEFICIARY_WEIGHT = 500 // 5%

export function parseMetadataObject (raw) {
  if (!raw) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw
  if (typeof raw !== 'string') return {}
  const text = raw.trim()
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Build the legacy `json_metadata` attached at account creation.
 * The sponsor is the creator; it is attribution, not a reward setting.
 */
export function buildAccountCreationMetadata ({ sponsor, via, nonce } = {}) {
  const metadata = {
    app: 'banksia.io',
    onboarding: {
      version: ONBOARDING_METADATA_VERSION
    }
  }
  if (via) metadata.via = String(via)
  if (nonce) metadata.nonce = String(nonce)
  const sponsorName = String(sponsor || '').trim().toLowerCase()
  if (sponsorName && isValidAccountName(sponsorName)) {
    metadata.onboarding.sponsor = sponsorName
  }
  return JSON.stringify(metadata)
}

/** Read the sponsor from either metadata field, tolerating old shapes. */
export function onboardingSponsor (jsonMetadata, postingJsonMetadata) {
  for (const raw of [postingJsonMetadata, jsonMetadata]) {
    const metadata = parseMetadataObject(raw)
    const fromObject = String(metadata?.onboarding?.sponsor || '').trim().toLowerCase()
    if (isValidAccountName(fromObject)) return fromObject
    const legacy = String(metadata?.sponsor || '').trim().toLowerCase()
    if (isValidAccountName(legacy)) return legacy
  }
  return ''
}

export function profileFromMetadata (raw) {
  const metadata = parseMetadataObject(raw)
  return metadata?.profile && typeof metadata.profile === 'object' && !Array.isArray(metadata.profile)
    ? metadata.profile
    : {}
}

export function hasProfileMetadata (raw) {
  return Object.keys(profileFromMetadata(raw)).length > 0
}

/** Account is considered new for onboarding prompts for 30 days. */
export function isNewAccount (created, now = Date.now(), days = 30) {
  const value = String(created || '').trim()
  if (!value) return false
  const date = new Date(value.endsWith('Z') ? value : value + 'Z')
  if (Number.isNaN(date.getTime())) return false
  return now - date.getTime() <= days * 86400000
}
