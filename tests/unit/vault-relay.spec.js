import { describe, expect, it, beforeEach } from 'vitest'
import { PrivateKey } from 'hive-tx'
import { sha256 } from '@noble/hashes/sha2.js'
import {
  buildRelayCertificate,
  createRelayBundle,
  openRelayBundle,
  relayCertificateFromAccount,
  relayCertificateHash,
  relayCertificateStatus,
  signRelayCertificate,
  verifyDelegatedBulletin,
  verifyRelayCertificate
} from '../../src/services/vaultRelay'
import {
  buildVaultBulletinBundle,
  buildVaultShardedBulletin,
  planShardUpdates,
  shardCountForEntries
} from '../../src/services/vaultBulletin'
import { buildBulletinSigningPayload } from '../../src/services/vaultGrant'
import { base64UrlEncode, randomBytes } from '../../src/services/vaultCrypto'
import { clearVaultBulletinCache, loadBulletinEntries, resolveBulletin, verifyBulletin } from '../../src/services/vaultUnlock'
import { verifyVaultPayloadForAccount } from '../../src/services/vaultSigning'

const BLOG = 'alice'
const RELAY = 'alice-relay'
const PERIOD = '2026-11'

function signWif (wif, payload) {
  const digest = sha256(new TextEncoder().encode(payload))
  return PrivateKey.from(wif).sign(digest).customToString()
}

function account (name, publicKey, relay = null) {
  return {
    name,
    posting: { key_auths: [[publicKey, 1]], account_auths: [] },
    posting_json_metadata: JSON.stringify({
      'banksia.io': {
        blog: {
          vault: {
            v: 1,
            enabled: true,
            product: 'alice/membership',
            container: 'banksia-vault',
            price: '5.000 HBD',
            recurrence: 730,
            executions: 12,
            ...(relay ? { relay } : {})
          }
        }
      }
    })
  }
}

async function fixture (options = {}) {
  const creator = PrivateKey.randomKey()
  const relay = PrivateKey.randomKey()
  const creatorWif = creator.toString()
  const relayWif = relay.toString()
  const creatorPublicKey = creator.createPublic().toString()
  const relayPublicKey = relay.createPublic().toString()
  const unsigned = buildRelayCertificate({
    blog: BLOG,
    delegateAccount: RELAY,
    delegatePublicKey: relayPublicKey,
    now: Date.now(),
    days: options.days === undefined ? 90 : options.days
  })
  const cert = await signRelayCertificate(unsigned, {
    sign: payload => signWif(creatorWif, payload)
  })
  return {
    creatorWif,
    relayWif,
    creatorPublicKey,
    relayPublicKey,
    creatorAccount: account(BLOG, creatorPublicKey, cert),
    relayAccount: account(RELAY, relayPublicKey),
    cert
  }
}

async function delegatedBulletin (data, seq = 2) {
  const certHash = await relayCertificateHash(data.cert)
  const result = await buildVaultBulletinBundle({
    blog: BLOG,
    period: PERIOD,
    seq,
    keyring: { [PERIOD]: base64UrlEncode(randomBytes(32)) },
    ringKey: base64UrlEncode(randomBytes(32)),
    entries: [{
      rkt: 'a1b2c3d4e5f6a7b8',
      alg: 'P256-HKDF-SHA256-A256GCM',
      epk: 'example',
      iv: 'AAECAwQFBgcICQoL',
      ct: 'example',
      tier: 'member',
      expires: '2026-12-27T12:00:00Z'
    }],
    signer: RELAY,
    issued: '2026-11-28T12:00:00Z',
    delegation: {
      certHash,
      delegate_account: RELAY,
      delegate: data.cert.delegate
    },
    signAdapter: { sign: payload => signWif(data.relayWif, payload) }
  })
  return result.bulletin
}

async function delegatedV2Bulletin (data, seq = 3) {
  const entries = [{
    rkt: 'a1b2c3d4e5f6a7b8',
    epk: 'example',
    iv: 'AAECAwQFBgcICQoL',
    ct: 'example',
    tier: 'member',
    expires: '2026-12-27T12:00:00.000Z'
  }]
  const shardCount = shardCountForEntries(entries.length)
  const planned = await planShardUpdates({
    blog: BLOG,
    period: PERIOD,
    shardCount,
    entries
  })
  const certHash = await relayCertificateHash(data.cert)
  const bulletin = await buildVaultShardedBulletin({
    blog: BLOG,
    period: PERIOD,
    seq,
    keyring: { [PERIOD]: base64UrlEncode(randomBytes(32)) },
    ringKey: base64UrlEncode(randomBytes(32)),
    shardCount,
    shards: planned.descriptors,
    signer: RELAY,
    issued: '2026-11-28T12:00:00Z',
    delegation: {
      certHash,
      delegate_account: RELAY,
      delegate: data.cert.delegate
    },
    signAdapter: { sign: payload => signWif(data.relayWif, payload) }
  })
  return { bulletin, shards: planned.shards }
}

describe('relay certificate', () => {
  it('builds, signs, hashes and verifies a creator certificate', async () => {
    const data = await fixture()
    expect(relayCertificateFromAccount(data.creatorAccount)).toEqual(data.cert)
    const result = await verifyRelayCertificate({
      cert: data.cert,
      blog: BLOG,
      relayAccount: RELAY,
      relayPublicKey: data.relayPublicKey,
      creatorAccount: data.creatorAccount,
      relayAccountObject: data.relayAccount,
      verify: args => verifyVaultPayloadForAccount(args)
    })
    expect(result.ok).toBe(true)
    expect(result.hash).toBe(await relayCertificateHash(data.cert))
  })

  it('rejects expiry, wrong blog, wrong relay key, bad scope and tampering', async () => {
    const data = await fixture({ days: 1 })
    const expired = { ...data.cert, notBefore: '2020-01-01T00:00:00.000Z', notAfter: '2020-02-01T00:00:00.000Z' }
    const base = {
      cert: expired,
      blog: BLOG,
      relayAccount: RELAY,
      relayPublicKey: data.relayPublicKey,
      creatorAccount: account(BLOG, data.creatorPublicKey, expired),
      verify: args => verifyVaultPayloadForAccount(args)
    }
    expect((await verifyRelayCertificate(base)).reason).toBe('expired')
    expect((await verifyRelayCertificate({ ...base, cert: data.cert, blog: 'bob' })).reason).toBe('wrong-blog')
    expect((await verifyRelayCertificate({ ...base, cert: data.cert, relayPublicKey: 'STM1111111111111111111111111111111111111111' })).reason).toBe('wrong-delegate-key')
    const scoped = { ...data.cert, scope: ['bulletin'] }
    expect((await verifyRelayCertificate({ ...base, cert: scoped })).ok).toBe(false)
    const tampered = { ...data.cert, nonce: 'zyxwvutsrqponmlkjihgfedc' }
    expect((await verifyRelayCertificate({ ...base, cert: tampered })).reason).toBe('bad-creator-signature')
  })

  it('verifies a certificate that uses second-precision Z timestamps', async () => {
    const data = await fixture()
    const now = Date.now()
    const unsigned = {
      ...data.cert,
      notBefore: new Date(now - 60000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      notAfter: new Date(now + 90 * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z')
    }
    delete unsigned.sig
    const signed = await signRelayCertificate(unsigned, { sign: payload => signWif(data.creatorWif, payload) })
    const result = await verifyRelayCertificate({
      cert: signed,
      blog: BLOG,
      relayAccount: RELAY,
      relayPublicKey: data.relayPublicKey,
      creatorAccount: account(BLOG, data.creatorPublicKey, signed),
      verify: args => verifyVaultPayloadForAccount(args)
    })
    expect(result.ok).toBe(true)
  })

  it('reports none/expired/valid status without throwing', async () => {
    expect(relayCertificateStatus(null).state).toBe('none')
    const data = await fixture({ days: 1 })
    expect(relayCertificateStatus(data.cert, { now: Date.now() + 2 * 86400000 }).state).toBe('expired')
    expect(relayCertificateStatus(data.cert).state).toBe('valid')
  })
})

describe('relay bundle', () => {
  it('round-trips and binds blog/relay AAD', async () => {
    const bundle = await createRelayBundle({
      blog: BLOG,
      relayAccount: RELAY,
      keyring: { [PERIOD]: base64UrlEncode(randomBytes(32)) },
      ringKid: PERIOD,
      ringKey: base64UrlEncode(randomBytes(32)),
      period: PERIOD,
      ringId: 'ring-id-for-reuse',
      passphrase: 'a-long-bundle-passphrase',
      iterations: 10000
    })
    const opened = await openRelayBundle({
      bundle,
      passphrase: 'a-long-bundle-passphrase',
      blog: BLOG,
      relayAccount: RELAY
    })
    expect(opened.period).toBe(PERIOD)
    expect(opened.ringId).toBe('ring-id-for-reuse')
    await expect(openRelayBundle({ bundle, passphrase: 'wrong', blog: BLOG, relayAccount: RELAY }))
      .rejects.toMatchObject({ code: 'VAULT_BAD_PASSPHRASE' })
  })
})

describe('delegated bulletin verification', () => {
  beforeEach(() => clearVaultBulletinCache())

  it('verifies a relay-authored bulletin only with a valid creator certificate', async () => {
    const data = await fixture()
    const bulletin = await delegatedBulletin(data)
    const result = await verifyDelegatedBulletin({
      bulletin,
      certificate: data.cert,
      certHash: bulletin.delegation.certHash,
      creatorAccount: data.creatorAccount,
      relayAccount: data.relayAccount,
      verify: args => verifyVaultPayloadForAccount(args)
    })
    expect(result.ok).toBe(true)

    const tampered = { ...bulletin, entries: bulletin.entries.map(entry => ({ ...entry })) }
    tampered.entries[0].ct = 'changed'
    await expect(verifyBulletin({
      bulletin: tampered,
      fetchAccount: async name => name === BLOG ? data.creatorAccount : data.relayAccount,
      allowDelegation: true
    })).resolves.toMatchObject({ ok: false, reason: 'signature' })

    const revoked = { ...data.creatorAccount, posting_json_metadata: JSON.stringify({ 'banksia.io': { blog: { vault: { v: 1 } } } }) }
    await expect(verifyBulletin({
      bulletin,
      fetchAccount: async name => name === BLOG ? revoked : data.relayAccount,
      allowDelegation: true
    })).resolves.toMatchObject({ ok: false })
  })

  it('falls back to relay replies when the creator pointer is stale', async () => {
    const data = await fixture()
    const relayBulletin = await delegatedBulletin(data, 2)
    const creatorBulletin = {
      ...await delegatedBulletin(data, 1),
      signer: BLOG,
      delegation: null
    }
    creatorBulletin.sig = signWif(data.creatorWif, await buildBulletinSigningPayload(creatorBulletin))
    const replies = [
      {
        author: BLOG,
        permlink: 'vault-2026-11-1',
        json_metadata: JSON.stringify({ banksia_vault_bulletin: creatorBulletin })
      },
      {
        author: RELAY,
        permlink: 'vault-2026-11-2',
        json_metadata: JSON.stringify({ banksia_vault_bulletin: relayBulletin })
      }
    ]
    const resolved = await resolveBulletin({
      blog: BLOG,
      settings: { container: 'banksia-vault', bulletin: { author: BLOG, permlink: 'missing' } },
      fetchPost: async () => null,
      fetchReplies: async () => replies,
      fetchAccount: async name => name === BLOG ? data.creatorAccount : data.relayAccount,
      allowRelay: true,
      force: true
    })
    expect(resolved.bulletin.seq).toBe(2)
    expect(resolved.pointer.author).toBe(RELAY)
  })

  it('does not accept an invalid relay comment over a valid creator bulletin', async () => {
    const data = await fixture()
    const valid = await delegatedBulletin(data, 1)
    valid.signer = BLOG
    valid.delegation = null
    valid.sig = signWif(data.creatorWif, await buildBulletinSigningPayload(valid))
    const invalidRelay = { ...await delegatedBulletin(data, 9), delegation: { ...(await delegatedBulletin(data, 9)).delegation, certHash: 'sha256:' + '0'.repeat(64) } }
    const resolved = await resolveBulletin({
      blog: BLOG,
      settings: { container: 'banksia-vault' },
      fetchPost: async () => null,
      fetchReplies: async () => [
        { author: RELAY, permlink: 'vault-2026-11-9', json_metadata: JSON.stringify({ banksia_vault_bulletin: invalidRelay }) },
        { author: BLOG, permlink: 'vault-2026-11-1', json_metadata: JSON.stringify({ banksia_vault_bulletin: valid }) }
      ],
      fetchAccount: async name => name === BLOG ? data.creatorAccount : data.relayAccount,
      allowRelay: true,
      force: true
    })
    expect(resolved.bulletin.seq).toBe(1)
    expect(resolved.pointer.author).toBe(BLOG)
  })
})

describe('delegated v2 sharded bulletins', () => {
  beforeEach(() => clearVaultBulletinCache())

  it('verifies and merges a relay-authored v2 manifest with the main reader', async () => {
    const data = await fixture()
    const { bulletin, shards } = await delegatedV2Bulletin(data)
    const byPermlink = new Map(shards.map(shard => [shard.permlink, shard]))
    const fetchAccount = async name => name === BLOG ? data.creatorAccount : data.relayAccount
    const fetchPost = async (author, permlink) => {
      const shard = byPermlink.get(permlink)
      return shard && author === RELAY
        ? { author: RELAY, permlink, json_metadata: JSON.stringify({ banksia_vault_shard: shard.object }) }
        : null
    }

    await expect(verifyBulletin({
      bulletin,
      fetchAccount,
      allowDelegation: true
    })).resolves.toEqual({ ok: true, reason: '' })

    const merged = await loadBulletinEntries({ bulletin, all: true, fetchPost })
    expect(merged.entries).toHaveLength(1)
    expect(merged.entries[0]).toMatchObject({
      rkt: 'a1b2c3d4e5f6a7b8',
      expires: '2026-12-27T12:00:00.000Z'
    })

    const tampered = {
      ...shards[0].object,
      entries: [[shards[0].object.entries[0][0], 'changed', 'iv', 'ct', shards[0].object.entries[0][4]]]
    }
    const badFetch = async () => ({ author: RELAY, permlink: shards[0].permlink, json_metadata: JSON.stringify({ banksia_vault_shard: tampered }) })
    await expect(loadBulletinEntries({ bulletin, all: true, fetchPost: badFetch })).resolves.toBeNull()
  })
})
