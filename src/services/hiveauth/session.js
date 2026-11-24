// HiveAuth session persistence.
//
// The session contains the relay token and the shared AES key. Neither can sign
// without the phone wallet, but both can request signatures. Keep them in
// sessionStorage (per tab, cleared on tab close) rather than localStorage.
//
// A small in-memory fallback keeps the current tab working when sessionStorage
// is unavailable or full (private mode, quota). It is never shared between tabs.

export const SESSION_PREFIX = 'hiveauth:session:'
export const PENDING_KEY = 'hiveauth:pending'

const PENDING_KINDS = new Set(['login', 'sign', 'challenge'])
const memory = new Map()
// One logical HiveAuth request at a time per tab, so the pending record is a
// single key rather than one per account.
let pendingMemory = null

function storage () {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

function keyFor (account) {
  return SESSION_PREFIX + account
}

function removeStored (account) {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(keyFor(account))
  } catch {}
}

function isSession (value, account) {
  return Boolean(value) &&
    typeof value === 'object' &&
    value.account === account &&
    typeof value.key === 'string' &&
    value.key.length > 0 &&
    typeof value.host === 'string' &&
    value.host.length > 0 &&
    (value.token === null || typeof value.token === 'string') &&
    (value.expire === null || Number.isFinite(Number(value.expire)))
}

function isExpired (session) {
  return session.expire !== null && session.expire <= Date.now()
}

function normalizeExpire (value) {
  if (value === null || value === undefined) return null
  const expire = Number(value)
  return Number.isFinite(expire) && expire > 0 ? expire : null
}

function normalize (value, account) {
  if (!isSession(value, account)) return null
  const session = {
    account,
    token: value.token,
    expire: normalizeExpire(value.expire),
    key: value.key,
    host: value.host
  }
  return isExpired(session) ? null : session
}

export function saveSession (account, session) {
  if (!account || !session?.key) return null
  const record = {
    account,
    token: typeof session.token === 'string' && session.token ? session.token : null,
    expire: normalizeExpire(session.expire),
    key: session.key,
    host: session.host
  }
  memory.set(account, record)
  const store = storage()
  if (!store) return record
  try {
    store.setItem(keyFor(account), JSON.stringify(record))
  } catch {
    // The in-memory copy still lets the current tab sign.
  }
  return record
}

export function loadSession (account) {
  if (!account) return null
  const store = storage()
  if (store) {
    const raw = store.getItem(keyFor(account))
    if (raw) {
      try {
        const session = normalize(JSON.parse(raw), account)
        if (session) {
          memory.set(account, session)
          return session
        }
      } catch {}
      removeStored(account)
    }
  }
  const cached = normalize(memory.get(account), account)
  if (cached) return cached
  memory.delete(account)
  return null
}

export function clearSession (account) {
  if (!account) return
  memory.delete(account)
  removeStored(account)
}

function normalizePending (value, { allowExpired = false } = {}) {
  if (!value || typeof value !== 'object') return null
  if (typeof value.account !== 'string' || !value.account) return null
  if (typeof value.uuid !== 'string' || !value.uuid) return null
  if (!PENDING_KINDS.has(value.kind)) return null
  const expire = Number(value.expire)
  if (!Number.isFinite(expire)) return null
  if (!allowExpired && expire <= Date.now()) return null
  if (value.kind === 'login' && (typeof value.key !== 'string' || !value.key)) return null
  return {
    account: value.account,
    uuid: value.uuid,
    kind: value.kind,
    expire,
    // Only a login has to survive a reload with the temporary auth key, so it
    // can decrypt the `auth_ack` that arrives after the page is restored. The
    // signing session key already lives in the account session record.
    key: value.kind === 'login' ? value.key : null
  }
}

export function savePending (pending) {
  const record = normalizePending(pending)
  if (!record) return null
  pendingMemory = record
  const store = storage()
  if (!store) return record
  try {
    store.setItem(PENDING_KEY, JSON.stringify(record))
  } catch {
    // The in-memory copy still covers a resume within this page load.
  }
  return record
}

export function loadPending ({ includeExpired = false } = {}) {
  const store = storage()
  if (store) {
    const raw = store.getItem(PENDING_KEY)
    if (raw) {
      try {
        const record = normalizePending(JSON.parse(raw), { allowExpired: includeExpired })
        if (record) {
          if (!includeExpired) pendingMemory = record
          return record
        }
      } catch {}
      removePendingStored()
    }
  }
  const cached = normalizePending(pendingMemory, { allowExpired: includeExpired })
  if (cached) return cached
  pendingMemory = null
  return null
}

// `uuid` guards a late completion from clearing a newer request's record.
export function clearPending (uuid) {
  const current = loadPending()
  if (uuid && current && current.uuid !== uuid) return
  pendingMemory = null
  removePendingStored()
}

function removePendingStored () {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(PENDING_KEY)
  } catch {}
}

export function clearAllSessions () {
  memory.clear()
  pendingMemory = null
  removePendingStored()
  const store = storage()
  if (!store) return
  try {
    const keys = []
    for (let index = 0; index < store.length; index++) {
      const key = store.key(index)
      if (key?.startsWith(SESSION_PREFIX)) keys.push(key)
    }
    for (const key of keys) store.removeItem(key)
  } catch {}
}
