// Tiny in-memory store for the read-only v4v.app session.
//
// Kept separate from v4vappAuth.js so the logout path in the header can clear
// it without pulling the signing stack into the main bundle. Nothing here is
// persisted except the non-secret client id.

const CLIENT_ID_KEY = 'v4vapp:clientId'

let clientId = ''
let session = null

// The logout button lives in the main bundle, so it cannot import this module
// without paying for it on every route. It dispatches a DOM event instead; this
// listener only exists once the keepsats/session chunk has loaded.
if (typeof window !== 'undefined') {
  window.addEventListener('hive:auth-logout', () => {
    session = null
  })
}

function normalize (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function randomHex (bytes = 16) {
  const values = new Uint8Array(bytes)
  const cryptoObject = globalThis.crypto
  if (cryptoObject?.getRandomValues) {
    cryptoObject.getRandomValues(values)
  } else {
    for (let index = 0; index < values.length; index += 1) {
      values[index] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('')
}

export function generateClientId () {
  return ('hiveausbit-' + randomHex(16)).slice(0, 40)
}

/** A clientId is 10–100 chars and is not a secret; it only correlates a browser. */
export function getClientId () {
  if (clientId) return clientId
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY)
    if (stored && stored.length >= 10 && stored.length <= 100) {
      clientId = stored
      return clientId
    }
  } catch {
    // Private mode or blocked storage: fall back to a per-session id.
  }
  clientId = generateClientId()
  try {
    localStorage.setItem(CLIENT_ID_KEY, clientId)
  } catch {
    // Not persisted; still usable for this tab.
  }
  return clientId
}

export function resetClientId () {
  clientId = ''
  try {
    localStorage.removeItem(CLIENT_ID_KEY)
  } catch {
    // Ignore blocked storage.
  }
}

/** Only v4vappAuth writes this; components read the summary below. */
export function setSessionRecord (value) {
  session = value
}

export function getSessionRecord () {
  return session
}

/** Summary only — the bearer token is never exposed here. */
export function getAuthSession (account = '') {
  if (!session) return null
  const name = normalize(account)
  if (name && session.account !== name) return null
  return {
    account: session.account,
    expiresAt: session.expiresAt,
    claims: session.claims,
    expired: session.expiresAt <= Date.now()
  }
}

export function clearAuthSession (account = '') {
  if (!session) return
  const name = normalize(account)
  if (!name || session.account === name) session = null
}
