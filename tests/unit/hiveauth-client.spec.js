import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HAS_HOST,
  authenticate,
  broadcast,
  isAvailable,
  signChallenge
} from '../../src/services/hiveauth/client'
import { decryptPayload, encryptPayload } from '../../src/services/hiveauth/crypto'
import { clearAllSessions, loadSession, saveSession } from '../../src/services/hiveauth/session'

class MockWebSocket {
  static instances = []

  static reset () {
    MockWebSocket.instances = []
  }

  constructor (url) {
    this.url = url
    this.sent = []
    this.readyState = 0
    this.onopen = null
    this.onmessage = null
    this.onerror = null
    this.onclose = null
    MockWebSocket.instances.push(this)
    queueMicrotask(() => {
      if (this.readyState === 3) return
      this.readyState = 1
      this.onopen?.()
      this.onmessage?.({
        data: JSON.stringify({
          cmd: 'connected',
          timeout: 60,
          version: '0.8.10',
          protocol: 0.8
        })
      })
    })
  }

  send (data) {
    this.sent.push(JSON.parse(data))
  }

  close () {
    if (this.readyState === 3) return
    this.readyState = 3
    const handler = this.onclose
    this.onclose = null
    handler?.({ code: 1000 })
  }

  emit (message) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }
}

async function waitFor (fn, timeout = 3000) {
  const started = Date.now()
  while (!fn()) {
    if (Date.now() - started > timeout) throw new Error('Timed out waiting for a mock WebSocket')
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

async function requestSocket (index = 0) {
  await waitFor(() => MockWebSocket.instances.length > index)
  const socket = MockWebSocket.instances[index]
  await waitFor(() => socket.sent.length > 0)
  return socket
}

const SESSION = {
  account: 'alice',
  token: 'token-1',
  expire: Date.now() + 60_000,
  key: 'session-key',
  host: HAS_HOST
}

describe('HiveAuth client', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto)
    vi.stubGlobal('WebSocket', MockWebSocket)
    MockWebSocket.reset()
    clearAllSessions()
    sessionStorage.clear()
    saveSession('alice', SESSION)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearAllSessions()
    sessionStorage.clear()
  })

  it('reports availability with WebSocket and Web Crypto', () => {
    expect(isAvailable()).toBe(true)
  })

  it('authenticates, exposes the QR payload, and stores the session', async () => {
    let payload
    const promise = authenticate('alice', {
      challenge: 'login',
      onPayload: value => { payload = value }
    })
    const socket = await requestSocket()
    expect(socket.sent[0]).toMatchObject({ cmd: 'auth_req', account: 'alice' })

    socket.emit({ cmd: 'auth_wait', uuid: 'auth-1', expire: Date.now() + 60_000 })
    await waitFor(() => Boolean(payload))
    expect(payload.account).toBe('alice')
    expect(payload.host).toBe(HAS_HOST)
    expect(payload.uri).toMatch(/^has:\/\/auth_req\//)
    const decodedPayload = JSON.parse(
      Buffer.from(payload.uri.slice('has://auth_req/'.length), 'base64').toString('utf8')
    )
    expect(decodedPayload).toEqual({
      account: 'alice',
      uuid: 'auth-1',
      key: payload.key,
      host: HAS_HOST
    })

    const authData = JSON.parse(await decryptPayload(socket.sent[0].data, payload.key))
    expect(authData.app.name).toBe('hive.ausbit.dev')
    expect(authData.challenge).toEqual({ key_type: 'posting', challenge: 'login' })

    const encrypted = await encryptPayload(JSON.stringify({
      token: 'token-2',
      expire: Date.now() + 60_000,
      challenge: { challenge: 'signature', pubkey: 'STM111' }
    }), payload.key)
    socket.emit({ cmd: 'auth_ack', uuid: 'auth-1', data: encrypted })

    const session = await promise
    expect(session).toMatchObject({
      account: 'alice',
      token: 'token-2',
      key: payload.key,
      host: HAS_HOST
    })
    expect(session.challenge).toEqual({ challenge: 'signature', pubkey: 'STM111' })
    expect(loadSession('alice')).toMatchObject({
      token: 'token-2',
      key: payload.key,
      host: HAS_HOST
    })
  })

  it('reconnects and attaches a pending request after the socket drops', async () => {
    let payload
    const promise = authenticate('alice', {
      challenge: 'login',
      onPayload: value => { payload = value }
    })
    const first = await requestSocket(0)
    first.emit({ cmd: 'auth_wait', uuid: 'auth-resume', expire: Date.now() + 60_000 })
    await waitFor(() => Boolean(payload))

    // The browser backgrounded while the wallet was open; the relay closes.
    first.onclose?.({ code: 1006 })

    await waitFor(() => MockWebSocket.instances.length > 1)
    const second = MockWebSocket.instances[1]
    await waitFor(() => second.sent.length > 0)
    expect(second.sent[0]).toEqual({ cmd: 'attach_req', uuid: 'auth-resume' })

    second.emit({ cmd: 'attach_ack', uuid: 'auth-resume' })
    const encrypted = await encryptPayload(JSON.stringify({
      token: 'token-resumed',
      expire: Date.now() + 60_000
    }), payload.key)
    second.emit({ cmd: 'auth_ack', uuid: 'auth-resume', data: encrypted })

    await expect(promise).resolves.toMatchObject({ token: 'token-resumed' })
  })

  it('rejects an auth refusal', async () => {
    const promise = authenticate('alice')
    const socket = await requestSocket()
    socket.emit({ cmd: 'auth_wait', uuid: 'auth-2', expire: Date.now() + 60_000 })
    socket.emit({ cmd: 'auth_nack', uuid: 'auth-2' })
    await expect(promise).rejects.toMatchObject({ code: 'rejected' })
    expect(loadSession('alice')).not.toBeNull()
  })

  it('broadcasts the exact operations and returns the transaction id', async () => {
    const operation = ['vote', { voter: 'alice', author: 'bob', permlink: 'x', weight: 10000 }]
    const promise = broadcast('alice', 'posting', [operation])
    const socket = await requestSocket()
    const signed = JSON.parse(await decryptPayload(socket.sent[0].data, SESSION.key))
    expect(signed.key_type).toBe('posting')
    expect(signed.ops).toEqual([operation])
    expect(signed.broadcast).toBe(true)
    expect(typeof signed.nonce).toBe('number')

    socket.emit({ cmd: 'sign_wait', uuid: 'sign-1', expire: Date.now() + 60_000 })
    socket.emit({ cmd: 'sign_ack', uuid: 'sign-1', broadcast: true, data: 'tx-1' })
    await expect(promise).resolves.toEqual({ txId: 'tx-1' })
  })

  it('ignores a response for a different request id', async () => {
    const promise = broadcast('alice', 'posting', [['vote', { voter: 'alice', author: 'bob', permlink: 'x', weight: 10000 }]])
    const socket = await requestSocket()
    socket.emit({ cmd: 'sign_wait', uuid: 'sign-2', expire: Date.now() + 60_000 })
    socket.emit({ cmd: 'sign_ack', uuid: 'other', broadcast: true, data: 'wrong' })
    socket.emit({ cmd: 'sign_ack', uuid: 'sign-2', broadcast: true, data: 'right' })
    await expect(promise).resolves.toEqual({ txId: 'right' })
  })

  it('surfaces a plaintext wallet rejection', async () => {
    const promise = broadcast('alice', 'active', [['transfer', { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: '' }]])
    const socket = await requestSocket()
    socket.emit({ cmd: 'sign_wait', uuid: 'sign-3', expire: Date.now() + 60_000 })
    socket.emit({ cmd: 'sign_nack', uuid: 'sign-3', error: 'Rejected on the phone.' })
    await expect(promise).rejects.toMatchObject({
      code: 'rejected',
      message: 'Rejected on the phone.'
    })
  })

  it('expires a request when the relay deadline passes', async () => {
    const promise = broadcast('alice', 'posting', [['vote', { voter: 'alice', author: 'bob', permlink: 'x', weight: 10000 }]])
    const socket = await requestSocket()
    socket.emit({ cmd: 'sign_wait', uuid: 'sign-4', expire: Date.now() + 10 })
    await expect(promise).rejects.toMatchObject({ code: 'expired' })
  })

  it('fails clearly when the relay closes', async () => {
    const promise = broadcast('alice', 'posting', [['vote', { voter: 'alice', author: 'bob', permlink: 'x', weight: 10000 }]])
    const socket = await requestSocket()
    socket.onclose?.({ code: 1006 })
    await expect(promise).rejects.toMatchObject({ code: 'relay' })
  })

  it('signs a challenge and returns the public key', async () => {
    const promise = signChallenge('alice', { challenge: 'hello', keyType: 'posting' })
    const socket = await requestSocket()
    const signed = JSON.parse(await decryptPayload(socket.sent[0].data, SESSION.key))
    expect(signed).toEqual({ key_type: 'posting', challenge: 'hello' })

    const encrypted = await encryptPayload(JSON.stringify({
      challenge: 'signature',
      pubkey: 'STM111'
    }), SESSION.key)
    socket.emit({ cmd: 'challenge_wait', uuid: 'challenge-1', expire: Date.now() + 60_000 })
    socket.emit({ cmd: 'challenge_ack', uuid: 'challenge-1', data: encrypted })
    await expect(promise).resolves.toEqual({ signature: 'signature', publicKey: 'STM111' })
  })

  it('refuses to sign without a session', async () => {
    clearAllSessions()
    await expect(broadcast('alice', 'posting', [['vote', {}]])).rejects.toMatchObject({
      code: 'login'
    })
  })
})
