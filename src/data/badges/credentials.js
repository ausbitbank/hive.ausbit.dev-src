// Curated credential badges.
//
// "Verified" is never self-claimed. A badge is only presented as a credential
// when its issuer and id match this data-driven allowlist. Everything else is
// an achievement, role or activity badge with a plain issuer label.

export const CREDENTIAL_BADGES = [
  {
    source: 'peakd',
    id: 'badge-069069',
    title: 'NFT Showroom Verified Artist',
    issuer: 'NFT Showroom'
  },
  {
    source: 'peakd',
    id: 'badge-112233',
    title: 'HL Verified',
    issuer: 'Hive Learners'
  },
  {
    source: 'peakd',
    id: 'badge-120334',
    title: "Lensy's Verified Photographer",
    issuer: 'Lensy'
  },
  {
    source: 'peakd',
    id: 'badge-020202',
    title: 'Hive "Verifieds"',
    issuer: 'Hive Verifieds'
  }
]

const BY_KEY = new Map(CREDENTIAL_BADGES.map(item => [item.source + ':' + item.id, item]))

export function credentialFor (source, id) {
  if (!source || !id) return null
  return BY_KEY.get(String(source).toLowerCase() + ':' + String(id).toLowerCase()) || null
}

export function isCredentialBadge (source, id) {
  return Boolean(credentialFor(source, id))
}
