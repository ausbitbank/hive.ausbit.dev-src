import { BRAND } from '../../config/brand'
import { validateAccountName } from '../hiveNames'
import {
  createAuthKey,
  decryptPayload,
  encryptPayload,
  bytesToBase64
} from './crypto'
import { HiveAuthError } from './errors'
import {
  clearPending,
  clearSession,
  loadPending,
  loadSession,
  savePending,
  saveSession
} from './session'

// The docs still show `has.hiveauth.com`, but that host currently fails TLS
// hostname verification. This is the relay the wrapper and Keychain Mobile use.
export const HAS_HOST = 'wss://hive-auth.arcange.eu/'

export const APP_META = Object.freeze({
  name: BRAND.name,
  description: BRAND.shortDescription,
  icon: BRAND.url + '/statics/icons/icon-512x512.png'
})

const CONNECT_TIMEOUT_MS = 12000
const DEFAULT_REQUEST_TIMEOUT_MS = 65000
// A relay cannot keep a login/sign request alive indefinitely. Wallet approval
// windows are short; cap anything longer than five minutes.
const MAX_REQUEST_TIMEOUT_MS = 5 * 60 * 1000

function clampDeadline (value, now = Date.now()) {
  const expire = Number(value)
  if (!Number.isFinite(expire) || expire <= now) return now + DEFAULT_REQUEST_TIMEOUT_MS
  return Math.min(expire, now + MAX_REQUEST_TIMEOUT_MS)
}
const KEY_TYPES = new Set(['posting', 'active', 'memo'])

let lastNonce = 0
function nextNonce () {
  lastNonce = Math.max(Date.now(), lastNonce + 1)
  return lastNonce
}

function parseMessage (data) {
  if (typeof data !== 'string') return null
  try {
    const message = JSON.parse(data)
    return message && typeof message === 'object' ? message : null
  } catch {
    return null
  }
}

function checkAccount (account) {
  const problem = validateAccountName(account)
  if (problem) throw new HiveAuthError(problem, { code: 'protocol' })
  return account
}

function checkKeyType (keyType) {
  if (!KEY_TYPES.has(keyType)) {
    throw new HiveAuthError('Invalid key type for HiveAuth.', { code: 'protocol' })
  }
  return keyType
}

/** Build the deep link / QR payload expected by a PKSA. */
export function authUri ({ account, uuid, key, host = HAS_HOST }) {
  if (!account || !uuid || !key || !host) {
    throw new HiveAuthError('Invalid HiveAuth payload.', { code: 'protocol' })
  }
  const json = JSON.stringify({ account, uuid, key, host })
  return 'has://auth_req/' + bytesToBase64(new TextEncoder().encode(json))
}

function openSocket (signal) {
  if (typeof WebSocket === 'undefined') {
    return Promise.reject(new HiveAuthError('HiveAuth needs a browser with WebSocket support.', {
      code: 'unavailable'
    }))
  }
  if (signal?.aborted) {
    return Promise.reject(new HiveAuthError('Cancelled.', { code: 'cancelled' }))
  }

  return new Promise((resolve, reject) => {
    let socket
    try {
      socket = new WebSocket(HAS_HOST)
    } catch (error) {
      reject(new HiveAuthError('Could not open a connection to the HiveAuth relay.', {
        code: 'relay',
        cause: error
      }))
      return
    }

    let settled = false
    const onAbort = () => finish(reject, new HiveAuthError('Cancelled.', { code: 'cancelled' }))
    const timer = setTimeout(() => {
      finish(reject, new HiveAuthError('The HiveAuth relay did not respond.', { code: 'relay' }))
    }, CONNECT_TIMEOUT_MS)

    function finish (handler, value, keepSocket = false) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
      if (!keepSocket) {
        try { socket.close() } catch {}
      }
      handler(value)
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    socket.onopen = () => {}
    socket.onerror = () => finish(reject, new HiveAuthError('Could not reach the HiveAuth relay.', {
      code: 'relay'
    }))
    socket.onclose = () => finish(reject, new HiveAuthError('The HiveAuth relay closed the connection.', {
      code: 'relay'
    }))
    socket.onmessage = event => {
      const message = parseMessage(event.data)
      if (!message) return
      if (message.cmd === 'connected') {
        const timeout = Number(message.timeout)
        finish(resolve, {
          socket,
          timeoutMs: Number.isFinite(timeout) && timeout > 0
            ? timeout * 1000
            : DEFAULT_REQUEST_TIMEOUT_MS
        }, true)
      } else if (message.cmd === 'error') {
        finish(reject, new HiveAuthError(
          typeof message.error === 'string' && message.error ? message.error : 'The HiveAuth relay returned an error.',
          { code: 'relay' }
        ))
      }
    }
  })
}

async function readError (message, authKey, command) {
  const raw = message.error
  if (typeof raw === 'string' && raw) {
    // HAS encrypts *_err errors; PKSA rejections are usually plaintext.
    if (command.endsWith('_err')) {
      try {
        const decrypted = await decryptPayload(raw, authKey)
        if (decrypted) return decrypted
      } catch {}
    }
    return raw
  }
  if (raw && typeof raw === 'object') {
    try { return JSON.stringify(raw) } catch {}
  }
  if (command === 'sign_nack') return 'The transaction was rejected in your wallet.'
  if (command === 'challenge_nack') return 'The signature request was rejected in your wallet.'
  return 'The HiveAuth request was rejected in your wallet.'
}

function parseAuthAck (authKey) {
  return async message => {
    const payload = JSON.parse(await decryptPayload(message.data, authKey))
    const expire = payload?.expire === null || payload?.expire === undefined
      ? null
      : Number(payload.expire)
    return {
      token: typeof payload?.token === 'string' && payload.token ? payload.token : null,
      expire: Number.isFinite(expire) && expire > 0 ? expire : null,
      challenge: payload?.challenge || null
    }
  }
}

/**
 * One logical request at a time. The socket can be recreated when a mobile
 * browser suspends the tab while the wallet is in front; after reconnecting we
 * send `attach_req` for the pending uuid, which lets the relay deliver the
 * PKSA's response instead of losing the approval.
 *
 * On `visibilitychange`, `pageshow` and `online` a pending request reconnects
 * immediately instead of waiting for a close event or the next backoff tick.
 * The pending uuid is kept in sessionStorage so a reload can resume a login.
 */
function runRequest ({
  command,
  account,
  data,
  authKey,
  token,
  signal,
  kind = 'sign',
  resume = null,
  onStatus,
  waitCommand,
  ackCommand,
  nackCommand,
  errCommand,
  onWait,
  parseAck,
  timeoutMessage,
  attachNackMessage
}) {
  if (signal?.aborted) {
    return Promise.reject(new HiveAuthError('Cancelled.', { code: 'cancelled' }))
  }

  return new Promise((resolve, reject) => {
    let socket = null
    let uuid = resume?.uuid || null
    let deadline = resume?.expire ? clampDeadline(resume.expire) : Date.now() + DEFAULT_REQUEST_TIMEOUT_MS
    let timer = null
    let reconnectTimer = null
    let reconnectAttempt = 0
    let connecting = false
    let settled = false

    const wakeTarget = typeof window !== 'undefined' ? window : null
    const onAbort = () => finish(reject, new HiveAuthError('Cancelled.', { code: 'cancelled' }))

    function emitStatus (state, extra = {}) {
      if (!onStatus) return
      try {
        onStatus({
          state,
          attempt: reconnectAttempt,
          expiresAt: deadline,
          remainingMs: Math.max(0, deadline - Date.now()),
          ...extra
        })
      } catch {}
    }

    function finish (handler, value) {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      timer = null
      reconnectTimer = null
      if (wakeTarget) {
        wakeTarget.removeEventListener('visibilitychange', wakeReconnect)
        wakeTarget.removeEventListener('pageshow', wakeReconnect)
        wakeTarget.removeEventListener('online', wakeReconnect)
      }
      signal?.removeEventListener('abort', onAbort)
      if (uuid) clearPending(uuid)
      if (socket) {
        socket.onmessage = null
        socket.onerror = null
        socket.onclose = null
        try { socket.close() } catch {}
        socket = null
      }
      handler(value)
    }

    function arm (until) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        emitStatus('expired')
        finish(reject, new HiveAuthError(
          timeoutMessage || 'The HiveAuth request expired.',
          { code: 'expired' }
        ))
      }, Math.max(0, until - Date.now()))
    }

    function scheduleReconnect () {
      if (settled || connecting || reconnectTimer) return
      if (!uuid || Date.now() >= deadline) {
        finish(reject, new HiveAuthError('The HiveAuth relay connection was lost.', {
          code: 'relay'
        }))
        return
      }
      const delay = Math.min(500 * 2 ** reconnectAttempt, 4000)
      reconnectAttempt += 1
      emitStatus('reconnecting', { attempt: reconnectAttempt, retryInMs: delay })
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connectAndSend()
      }, delay)
    }

    function handleClose () {
      socket = null
      if (settled) return
      scheduleReconnect()
    }

    // A suspended mobile tab may not emit a clean `close`. When the page wakes,
    // rebuild the socket and attach immediately rather than waiting for one.
    function wakeReconnect (event) {
      if (settled || connecting) return
      if (event?.type === 'visibilitychange' &&
        typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (!uuid) return
      if (Date.now() >= deadline) {
        emitStatus('expired')
        finish(reject, new HiveAuthError(
          timeoutMessage || 'The HiveAuth request expired.',
          { code: 'expired' }
        ))
        return
      }
      if (socket && socket.readyState === 1) {
        emitStatus('waiting')
        return
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      if (socket) {
        socket.onmessage = null
        socket.onerror = null
        socket.onclose = null
        try { socket.close() } catch {}
        socket = null
      }
      reconnectAttempt += 1
      emitStatus('reconnecting', { attempt: reconnectAttempt, immediate: true })
      connectAndSend()
    }

    function registerWakeListeners () {
      if (!wakeTarget) return
      wakeTarget.addEventListener('visibilitychange', wakeReconnect)
      wakeTarget.addEventListener('pageshow', wakeReconnect)
      wakeTarget.addEventListener('online', wakeReconnect)
    }

    async function handleMessage (event) {
      if (settled) return
      const message = parseMessage(event.data)
      if (!message) return
      try {
        if (message.cmd === 'error') {
          finish(reject, new HiveAuthError(
            typeof message.error === 'string' && message.error ? message.error : 'The HiveAuth relay returned an error.',
            { code: 'relay' }
          ))
          return
        }
        if (message.cmd === 'attach_ack') {
          if (message.uuid && uuid && message.uuid !== uuid) return
          reconnectAttempt = 0
          emitStatus('resumed')
          return
        }
        if (message.cmd === 'attach_nack') {
          if (message.uuid && uuid && message.uuid !== uuid) return
          emitStatus('expired')
          finish(reject, new HiveAuthError(
            attachNackMessage ||
              'The HiveAuth request expired before it could be resumed. Check the chain before retrying a transaction.',
            { code: 'expired' }
          ))
          return
        }
        if (message.cmd === waitCommand) {
          if (typeof message.uuid !== 'string' || !message.uuid) {
            throw new HiveAuthError('HiveAuth returned an invalid request id.', { code: 'protocol' })
          }
          if (uuid && message.uuid !== uuid) return
          uuid = message.uuid
          const expire = Number(message.expire)
          deadline = clampDeadline(expire)
          arm(deadline)
          savePending({
            account,
            uuid,
            kind,
            expire: deadline,
            key: kind === 'login' ? authKey : null
          })
          emitStatus('waiting')
          if (onWait) {
            try {
              const result = onWait({ uuid, expire: deadline, key: authKey, account })
              if (result?.catch) result.catch(() => {})
            } catch {}
          }
          return
        }
        if (!uuid || message.uuid !== uuid) return
        if (message.cmd === ackCommand) {
          const value = parseAck ? await parseAck(message) : message
          finish(resolve, value)
          return
        }
        if (message.cmd === nackCommand || message.cmd === errCommand) {
          finish(reject, new HiveAuthError(
            await readError(message, authKey, message.cmd),
            { code: 'rejected' }
          ))
        }
      } catch (error) {
        finish(reject, error instanceof HiveAuthError
          ? error
          : new HiveAuthError(error?.message || 'HiveAuth request failed.', {
            code: 'protocol',
            cause: error
          }))
      }
    }

    async function connectAndSend () {
      if (settled || connecting) return
      connecting = true
      try {
        const connection = await openSocket(signal)
        connecting = false
        if (settled) {
          try { connection.socket.close() } catch {}
          return
        }
        socket = connection.socket
        reconnectAttempt = 0
        socket.onerror = () => {}
        socket.onclose = handleClose
        socket.onmessage = handleMessage
        if (uuid) {
          socket.send(JSON.stringify({ cmd: 'attach_req', uuid }))
          return
        }
        deadline = Date.now() + connection.timeoutMs
        const payload = { cmd: command, account, data }
        if (typeof token === 'string' && token) payload.token = token
        socket.send(JSON.stringify(payload))
        arm(deadline)
      } catch (error) {
        connecting = false
        if (settled) return
        if (signal?.aborted) {
          finish(reject, new HiveAuthError('Cancelled.', { code: 'cancelled' }))
          return
        }
        if (uuid && Date.now() < deadline) {
          scheduleReconnect()
          return
        }
        finish(reject, error instanceof HiveAuthError
          ? error
          : new HiveAuthError('Could not connect to the HiveAuth relay.', {
            code: 'relay',
            cause: error
          }))
      }
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    registerWakeListeners()
    if (resume) {
      arm(deadline)
      emitStatus('reconnecting', { attempt: 0, immediate: true })
    }
    connectAndSend()
  })
}

export function isAvailable () {
  return typeof WebSocket !== 'undefined' &&
    Boolean(globalThis.crypto?.subtle) &&
    typeof globalThis.crypto?.getRandomValues === 'function'
}

export async function authenticate (account, { signal, onPayload, onStatus, challenge } = {}) {
  checkAccount(account)
  const authKey = createAuthKey()
  const authData = { app: APP_META }
  if (typeof challenge === 'string' && challenge) {
    authData.challenge = { key_type: 'posting', challenge }
  }
  const data = await encryptPayload(JSON.stringify(authData), authKey)

  const result = await runRequest({
    command: 'auth_req',
    account,
    data,
    authKey,
    signal,
    kind: 'login',
    onStatus,
    waitCommand: 'auth_wait',
    ackCommand: 'auth_ack',
    nackCommand: 'auth_nack',
    errCommand: 'auth_err',
    timeoutMessage: 'The HiveAuth login request expired.',
    attachNackMessage: 'The HiveAuth login request expired before it could be resumed. Approve a new login request.',
    onWait: payload => {
      const authPayload = { ...payload, host: HAS_HOST }
      onPayload?.({ ...authPayload, uri: authUri(authPayload) })
    },
    parseAck: parseAuthAck(authKey)
  })

  const session = {
    account,
    token: result.token,
    expire: result.expire,
    key: authKey,
    host: HAS_HOST
  }
  saveSession(account, session)
  return { ...session, challenge: result.challenge }
}

/**
 * Finish a login whose page was reloaded while the wallet approval was still
 * pending. The temporary auth key and uuid live in sessionStorage for at most
 * the relay's 60-second window; this attaches to the same request instead of
 * starting a second one.
 */
export async function resumeAuthentication (account, { signal, onStatus } = {}) {
  checkAccount(account)
  const pending = loadPending()
  if (!pending || pending.kind !== 'login' || pending.account !== account || !pending.key) {
    return null
  }
  const authKey = pending.key
  const result = await runRequest({
    command: 'auth_req',
    account,
    data: null,
    authKey,
    signal,
    kind: 'login',
    resume: pending,
    onStatus,
    waitCommand: 'auth_wait',
    ackCommand: 'auth_ack',
    nackCommand: 'auth_nack',
    errCommand: 'auth_err',
    timeoutMessage: 'The HiveAuth login request expired.',
    attachNackMessage: 'The HiveAuth login request expired before it could be resumed. Approve a new login request.',
    parseAck: parseAuthAck(authKey)
  })
  const session = {
    account,
    token: result.token,
    expire: result.expire,
    key: authKey,
    host: HAS_HOST
  }
  saveSession(account, session)
  return { ...session, challenge: result.challenge }
}

function requireSession (account) {
  checkAccount(account)
  const session = loadSession(account)
  if (!session) {
    throw new HiveAuthError('HiveAuth is not connected for this account. Sign in again.', {
      code: 'login'
    })
  }
  if (session.host !== HAS_HOST) {
    clearSession(account)
    throw new HiveAuthError('The HiveAuth session uses a different relay. Sign in again.', {
      code: 'login'
    })
  }
  return session
}

export async function broadcast (account, keyType, operations, { signal, onStatus } = {}) {
  checkKeyType(keyType)
  if (keyType !== 'posting' && keyType !== 'active') {
    throw new HiveAuthError('HiveAuth can only broadcast with posting or active keys.', {
      code: 'protocol'
    })
  }
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new HiveAuthError('There are no operations to broadcast.', { code: 'protocol' })
  }
  const session = requireSession(account)
  const data = await encryptPayload(JSON.stringify({
    key_type: keyType,
    ops: operations,
    broadcast: true,
    nonce: nextNonce()
  }), session.key)

  return runRequest({
    command: 'sign_req',
    account,
    data,
    authKey: session.key,
    token: session.token,
    signal,
    kind: 'sign',
    onStatus,
    waitCommand: 'sign_wait',
    ackCommand: 'sign_ack',
    nackCommand: 'sign_nack',
    errCommand: 'sign_err',
    timeoutMessage: 'The HiveAuth signing request expired.',
    parseAck: message => {
      if (message.broadcast === false) {
        throw new HiveAuthError('The wallet signed but did not broadcast the transaction.', {
          code: 'rejected'
        })
      }
      const txId = typeof message.data === 'string'
        ? message.data
        : (message.data?.tx_id || message.data?.id || '')
      if (!txId) {
        throw new HiveAuthError('HiveAuth did not return a transaction id.', { code: 'protocol' })
      }
      return { txId }
    }
  })
}

export async function signChallenge (account, { keyType = 'posting', challenge, signal, onStatus } = {}) {
  checkKeyType(keyType)
  if (typeof challenge !== 'string' || !challenge) {
    throw new HiveAuthError('The signature challenge is missing.', { code: 'protocol' })
  }
  const session = requireSession(account)
  const data = await encryptPayload(JSON.stringify({
    key_type: keyType,
    challenge
  }), session.key)

  return runRequest({
    command: 'challenge_req',
    account,
    data,
    authKey: session.key,
    token: session.token,
    signal,
    kind: 'challenge',
    onStatus,
    waitCommand: 'challenge_wait',
    ackCommand: 'challenge_ack',
    nackCommand: 'challenge_nack',
    errCommand: 'challenge_err',
    timeoutMessage: 'The HiveAuth signature request expired.',
    attachNackMessage: 'The HiveAuth signature request expired before it could be resumed. Try the action again.',
    parseAck: async message => {
      const payload = JSON.parse(await decryptPayload(message.data, session.key))
      const signature = payload?.challenge || payload?.signature
      if (typeof signature !== 'string' || !signature) {
        throw new HiveAuthError('HiveAuth did not return a signature.', { code: 'protocol' })
      }
      const publicKey = payload?.pubkey || payload?.publicKey || ''
      return {
        signature,
        publicKey: typeof publicKey === 'string' ? publicKey : ''
      }
    }
  })
}
