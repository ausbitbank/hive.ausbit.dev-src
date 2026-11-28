import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import {
  clearVaultBulletinCache,
  findGrantEntry,
  loadBulletinParts,
  mayAutoUnlock,
  resolveBulletin,
  unlockWithGrant,
  verifyBulletin
} from '../../src/services/vaultUnlock'
import {
  buildBulletinSigningPayload,
  buildGrantHeader,
  parseBulletin
} from '../../src/services/vaultGrant'
import {
  encryptPayload,
  generateReaderKeyPair,
  randomKey,
  readerKeyThumbprint,
  sealKeyring,
  sha256Hex,
  wrapRingKey
} from '../../src/services/vaultCrypto'
import { chunkVaultPayload } from '../../src/services/vaultPayload'
import {
  clearReaderKeyMemory,
  ensureReaderKey,
  forgetReaderKey,
  getReaderKey
} from '../../src/services/vaultReaderKey'
import { isBlogPost, isVaultHiddenPost } from '../../src/services/blogPosts'
import { useVaultStore } from '../../src/stores/vault'
import VaultLockedSection from '../../src/components/blog/VaultLockedSection.vue'
import VaultPaywall from '../../src/components/blog/VaultPaywall.vue'
import { buildVaultBulletinBundle } from '../../src/services/vaultBulletin'

const BLOG = 'alice'
const PERIOD = '2026-11'
const NOW = Date.parse('2026-11-27T12:00:00Z')

function simpleBulletin ({ seq = 1, period = PERIOD, blog = BLOG } = {}) {
  return {
    v: 1,
    blog,
    period,
    seq,
    issued: '2026-11-27T12:00:00Z',
    keyring: { alg: 'A256GCM', iv: 'a'.repeat(16), ct: 'b'.repeat(32) },
    entries: [{
      rkt: 'a'.repeat(16),
      alg: 'P256-HKDF-SHA256-A256GCM',
      epk: 'c'.repeat(87),
      iv: 'd'.repeat(16),
      ct: 'e'.repeat(40),
      tier: 'member',
      expires: '2026-12-27T12:00:00Z'
    }],
    claims: [],
    signer: blog,
    delegation: null
  }
}

function replyFor (bulletin) {
  return {
    author: bulletin.blog,
    permlink: 'vault-' + bulletin.period + '-' + bulletin.seq,
    json_metadata: JSON.stringify({ banksia_vault_bulletin: bulletin })
  }
}

function flipLastCharacter (value) {
  const last = value.slice(-1)
  const replacement = last === 'A' ? 'B' : 'A'
  return value.slice(0, -1) + replacement
}

async function makeRoundTripFixture ({ expires = '2026-12-27T12:00:00Z' } = {}) {
  const reader = await generateReaderKeyPair({ extractable: true })
  const rkt = await readerKeyThumbprint(reader.publicKeyB64)
  const contentKey = randomKey()
  const ringKey = randomKey()
  const kid = '2026-11'
  const blog = 'alice'
  const permlink = 'premium'
  const mode = 'section'
  const plaintext = '# Members only\n\nThe quiet part is the point.'

  const sealed = await sealKeyring({ [kid]: contentKey }, ringKey, { blog, period: PERIOD })
  const payload = await encryptPayload(plaintext, contentKey, { blog, permlink, kid, mode })
  const header = buildGrantHeader({ rkt, tier: 'member', expires }, { blog, period: PERIOD, tier: 'member' })
  const wrapped = await wrapRingKey(ringKey, reader.publicKeyB64, header)
  const entry = { ...wrapped, rkt, tier: 'member', expires }

  const bulletin = {
    v: 1,
    blog,
    period: PERIOD,
    seq: 1,
    issued: '2026-11-27T12:00:00Z',
    keyring: sealed,
    entries: [entry],
    claims: [],
    signer: blog,
    delegation: null
  }

  return {
    reader,
    rkt,
    entry,
    bulletin,
    contentKey,
    metadata: { ...payload, kid, mode },
    plaintext,
    blog,
    permlink
  }
}

beforeEach(() => {
  clearVaultBulletinCache()
  clearReaderKeyMemory()
})

describe('resolveBulletin', () => {
  it('uses the blog pointer first and caches the result for five minutes', async () => {
    const bulletin = simpleBulletin({ seq: 3 })
    const post = replyFor(bulletin)
    const fetchPost = vi.fn(async () => post)
    const fetchReplies = vi.fn(async () => [])
    const settings = {
      container: 'banksia-vault',
      bulletin: { author: BLOG, permlink: 'vault-2026-11-3' }
    }

    const first = await resolveBulletin({ blog: BLOG, settings, fetchPost, fetchReplies })
    expect(first.bulletin.seq).toBe(3)
    expect(first.pointer).toEqual({ author: BLOG, permlink: 'vault-2026-11-3' })
    expect(fetchPost).toHaveBeenCalledTimes(1)
    expect(fetchReplies).not.toHaveBeenCalled()

    const cached = await resolveBulletin({ blog: BLOG, settings, fetchPost, fetchReplies })
    expect(cached).toBe(first)
    expect(fetchPost).toHaveBeenCalledTimes(1)

    clearVaultBulletinCache(BLOG)
    await resolveBulletin({ blog: BLOG, settings, fetchPost, fetchReplies })
    expect(fetchPost).toHaveBeenCalledTimes(2)
  })

  it('falls back to container replies and picks the newest seq', async () => {
    const one = simpleBulletin({ seq: 1 })
    const three = simpleBulletin({ seq: 3 })
    const two = simpleBulletin({ seq: 2 })
    const fetchPost = vi.fn(async () => null)
    const fetchReplies = vi.fn(async () => [replyFor(one), replyFor(three), replyFor(two)])

    const resolved = await resolveBulletin({
      blog: BLOG,
      settings: { container: 'banksia-vault', bulletin: { author: BLOG, permlink: 'missing' } },
      fetchPost,
      fetchReplies
    })

    expect(resolved.bulletin.seq).toBe(3)
    expect(resolved.pointer).toEqual({ author: BLOG, permlink: 'vault-2026-11-3' })
    expect(fetchReplies).toHaveBeenCalledWith(BLOG, 'banksia-vault')
  })

  it('ignores a higher-sequence bulletin authored by a third party', async () => {
    const creator = simpleBulletin({ seq: 1 })
    const attacker = simpleBulletin({ seq: 9 })
    const foreign = { ...replyFor(attacker), author: 'mallory' }
    const fetchPost = vi.fn(async () => null)
    const fetchReplies = vi.fn(async () => [foreign, replyFor(creator)])

    const resolved = await resolveBulletin({
      blog: BLOG,
      settings: { container: 'banksia-vault' },
      fetchPost,
      fetchReplies
    })

    expect(resolved.bulletin.seq).toBe(1)
  })
})

describe('verifyBulletin', () => {
  const account = {
    name: BLOG,
    posting: { key_auths: [['STM1111111111111111111111111111111111111111', 1]], account_auths: [] }
  }

  it('accepts a matching signature and rejects tampering or missing fields', async () => {
    const bulletin = simpleBulletin()
    const payload = await buildBulletinSigningPayload(bulletin)
    bulletin.sig = await sha256Hex(payload)
    const verify = async ({ payload, signature }) => signature === await sha256Hex(payload)
    const fetchAccount = vi.fn(async () => account)

    await expect(verifyBulletin({ bulletin, fetchAccount, verify }))
      .resolves.toEqual({ ok: true, reason: '' })

    const tampered = {
      ...bulletin,
      entries: [{ ...bulletin.entries[0], ct: 'f'.repeat(40) }]
    }
    await expect(verifyBulletin({ bulletin: tampered, fetchAccount, verify }))
      .resolves.toMatchObject({ ok: false, reason: 'signature' })

    const missingSig = { ...bulletin }
    delete missingSig.sig
    await expect(verifyBulletin({ bulletin: missingSig, fetchAccount, verify }))
      .resolves.toMatchObject({ ok: false, reason: 'missing-sig' })

    const delegated = { ...bulletin, delegation: { relay: 'relay' } }
    await expect(verifyBulletin({ bulletin: delegated, fetchAccount, verify }))
      .resolves.toMatchObject({ ok: false, reason: 'delegation-unsupported' })

    const foreignSigner = { ...bulletin, signer: 'mallory' }
    await expect(verifyBulletin({ bulletin: foreignSigner, fetchAccount, verify }))
      .resolves.toMatchObject({ ok: false, reason: 'signer' })
  })
})

describe('unlockWithGrant', () => {
  it('round-trips a section payload with the matching reader key', async () => {
    const fixture = await makeRoundTripFixture()
    const parsed = parseBulletin({ banksia_vault_bulletin: fixture.bulletin })
    expect(parsed).not.toBeNull()

    const entry = await findGrantEntry({
      bulletin: parsed,
      readerPublicKey: fixture.reader.publicKeyB64
    })
    expect(entry).not.toBeNull()

    const result = await unlockWithGrant({
      bulletin: parsed,
      entry,
      readerKey: {
        privateKey: fixture.reader.privateKey,
        publicKeyB64: fixture.reader.publicKeyB64
      },
      metadata: fixture.metadata,
      blog: fixture.blog,
      permlink: fixture.permlink,
      now: NOW
    })

    expect(result.ok).toBe(true)
    expect(result.plaintext).toBe(fixture.plaintext)
    expect(result.period).toBe(PERIOD)
  })

  it('decrypts companion-comment parts in order', async () => {
    const fixture = await makeRoundTripFixture()
    const parsed = parseBulletin({ banksia_vault_bulletin: fixture.bulletin })
    const entry = await findGrantEntry({
      bulletin: parsed,
      readerPublicKey: fixture.reader.publicKeyB64
    })
    const header = {
      blog: fixture.blog,
      permlink: fixture.permlink,
      kid: '2026-11',
      mode: 'section'
    }
    const parts = await chunkVaultPayload(fixture.plaintext, fixture.contentKey, header, { chunkSize: 10 })
    const metadata = {
      v: 1,
      mode: 'section',
      alg: 'A256GCM',
      kid: '2026-11',
      parts: parts.map((part, index) => 'vault-payload-' + (index + 1)),
      hash: 'sha256:' + await sha256Hex(fixture.plaintext),
      bytes: new TextEncoder().encode(fixture.plaintext).length
    }

    const result = await unlockWithGrant({
      bulletin: parsed,
      entry,
      readerKey: {
        privateKey: fixture.reader.privateKey,
        publicKeyB64: fixture.reader.publicKeyB64
      },
      metadata,
      parts,
      blog: fixture.blog,
      permlink: fixture.permlink,
      now: NOW
    })

    expect(result.ok).toBe(true)
    expect(result.plaintext).toBe(fixture.plaintext)
  })

  it('fails for a different reader key', async () => {
    const fixture = await makeRoundTripFixture()
    const other = await generateReaderKeyPair({ extractable: true })
    const parsed = parseBulletin({ banksia_vault_bulletin: fixture.bulletin })

    expect(await findGrantEntry({ bulletin: parsed, readerPublicKey: other.publicKeyB64 })).toBeNull()

    const result = await unlockWithGrant({
      bulletin: parsed,
      entry: parsed.entries[0],
      readerKey: { privateKey: other.privateKey, publicKeyB64: other.publicKeyB64 },
      metadata: fixture.metadata,
      blog: fixture.blog,
      permlink: fixture.permlink,
      now: NOW
    })

    expect(result.ok).toBe(false)
    expect(['wrong-key', 'tampered']).toContain(result.code)
  })

  it('rejects an expired grant before decrypting', async () => {
    const fixture = await makeRoundTripFixture({ expires: '2026-01-01T00:00:00Z' })
    const parsed = parseBulletin({ banksia_vault_bulletin: fixture.bulletin })
    const entry = await findGrantEntry({
      bulletin: parsed,
      readerPublicKey: fixture.reader.publicKeyB64
    })

    const result = await unlockWithGrant({
      bulletin: parsed,
      entry,
      readerKey: {
        privateKey: fixture.reader.privateKey,
        publicKeyB64: fixture.reader.publicKeyB64
      },
      metadata: fixture.metadata,
      blog: fixture.blog,
      permlink: fixture.permlink,
      now: NOW
    })

    expect(result).toMatchObject({ ok: false, code: 'expired' })
    expect(result.plaintext).toBeUndefined()
  })

  it('reports tampered ciphertext and a missing kid as failures, never partial text', async () => {
    const fixture = await makeRoundTripFixture()
    const parsed = parseBulletin({ banksia_vault_bulletin: fixture.bulletin })
    const entry = await findGrantEntry({
      bulletin: parsed,
      readerPublicKey: fixture.reader.publicKeyB64
    })

    const tampered = await unlockWithGrant({
      bulletin: parsed,
      entry,
      readerKey: {
        privateKey: fixture.reader.privateKey,
        publicKeyB64: fixture.reader.publicKeyB64
      },
      metadata: { ...fixture.metadata, ct: flipLastCharacter(fixture.metadata.ct) },
      blog: fixture.blog,
      permlink: fixture.permlink,
      now: NOW
    })
    expect(tampered.ok).toBe(false)
    expect(tampered.code).toBe('tampered')
    expect(tampered.plaintext).toBeUndefined()

    const wrongKid = await unlockWithGrant({
      bulletin: parsed,
      entry,
      readerKey: {
        privateKey: fixture.reader.privateKey,
        publicKeyB64: fixture.reader.publicKeyB64
      },
      metadata: { ...fixture.metadata, kid: '2026-12' },
      blog: fixture.blog,
      permlink: fixture.permlink,
      now: NOW
    })
    expect(wrongKid).toMatchObject({ ok: false, code: 'wrong-key' })
  })
})

describe('vault store', () => {
  it('leaves a post locked when no reader key exists, without generating one', async () => {
    setActivePinia(createPinia())
    const store = useVaultStore()
    const blog = 'nokeyvisitor'

    const result = await store.unlockPost({
      blog,
      author: blog,
      permlink: 'premium',
      metadata: { v: 1, mode: 'section', alg: 'A256GCM', kid: '2026-11', iv: 'a', ct: 'b', hash: 'sha256:' + '0'.repeat(64), bytes: 1 },
      settings: {}
    })

    expect(result.ok).toBe(false)
    expect(store.postState(blog, 'premium').status).toBe('no-key')
    expect(await getReaderKey(blog)).toBeNull()
  })
})

describe('reader key lifecycle', () => {
  it('is idempotent per blog and can be forgotten', async () => {
    const blog = 'readerkeyblog'
    const first = await ensureReaderKey(blog)
    const second = await ensureReaderKey(blog)

    expect(first.publicKeyB64).toMatch(/^p256:/)
    expect(first.rkt).toMatch(/^[0-9a-f]{16}$/)
    expect(second.publicKeyB64).toBe(first.publicKeyB64)

    await forgetReaderKey(blog)
    expect(await getReaderKey(blog)).toBeNull()
  })

  it('records the subscribing account and rebinds the origin key', async () => {
    const blog = 'readerkeyaccount'
    const first = await ensureReaderKey(blog, { account: 'bob' })
    expect(first.account).toBe('bob')
    expect((await getReaderKey(blog)).account).toBe('bob')

    const rebound = await ensureReaderKey(blog, { account: 'carol' })
    expect(rebound.publicKeyB64).toBe(first.publicKeyB64)
    expect(rebound.account).toBe('carol')
    expect((await getReaderKey(blog)).account).toBe('carol')
  })
})

describe('auto-unlock policy', () => {
  it('requires a signed-in reader and a matching key owner', () => {
    expect(mayAutoUnlock({ readerAccount: '', keyAccount: 'bob' })).toBe(false)
    expect(mayAutoUnlock({ readerAccount: 'bob', keyAccount: 'bob' })).toBe(true)
    expect(mayAutoUnlock({ readerAccount: 'bob', keyAccount: 'carol' })).toBe(false)
    expect(mayAutoUnlock({ readerAccount: 'bob', keyAccount: '' })).toBe(true)
  })
})

describe('blog archive filter', () => {
  function post (overrides = {}) {
    return {
      author: 'alice',
      permlink: 'a-post',
      body: 'Hello world.',
      json_metadata: '{}',
      ...overrides
    }
  }

  it('hides the container and the HOM product but keeps normal posts', () => {
    const container = post({
      permlink: 'banksia-vault',
      json_metadata: JSON.stringify({ banksia_vault_container: true })
    })
    const product = post({
      permlink: 'membership',
      json_metadata: JSON.stringify({ content_type: 'product', price: 5 })
    })
    const normal = post()

    expect(isVaultHiddenPost(container)).toBe(true)
    expect(isVaultHiddenPost(product)).toBe(true)
    expect(isVaultHiddenPost(normal)).toBe(false)
    expect(isBlogPost(container)).toBe(false)
    expect(isBlogPost(product)).toBe(false)
    expect(isBlogPost(normal)).toBe(true)
  })
})

describe('VaultLockedSection', () => {
  const plan = {
    author: 'alice',
    permlink: 'membership',
    priceLabel: '5.000 HBD',
    plan: 'member'
  }
  const metadata = {
    paywall: {
      title: 'Members-only',
      body: 'Read the rest of this essay.',
      benefits: ['Every members-only post', 'The full archive']
    }
  }

  it('renders a semantic paywall and never the locked plaintext', () => {
    const wrapper = mount(VaultLockedSection, {
      props: {
        metadata,
        plaintext: 'TOP SECRET PREMIUM TEXT',
        state: { status: 'locked', message: '' },
        plan,
        blog: 'alice'
      },
      global: { stubs: { Render: true } }
    })

    expect(wrapper.find('section.banksia-locked').exists()).toBe(true)
    expect(wrapper.find('h2').text()).toBe('Members-only')
    expect(wrapper.text()).toContain('Subscribe')
    expect(wrapper.text()).toContain('Already a member? Restore access')
    expect(wrapper.text()).toContain('Cancel anytime')
    expect(wrapper.text()).toContain('Powered by Hive')
    expect(wrapper.text()).not.toContain('TOP SECRET PREMIUM TEXT')
  })

  it('renders unlocked content through Render and announces the unlock', () => {
    const wrapper = mount(VaultLockedSection, {
      props: {
        metadata,
        plaintext: '<p>Hidden member body</p>',
        state: {
          status: 'unlocked',
          plaintext: '<p>Hidden member body</p>',
          period: '2026-11',
          reader: { label: 'Licensed to @bob · 2026-11' }
        },
        plan,
        blog: 'alice',
        readerAccount: 'bob'
      },
      global: {
        stubs: {
          Render: {
            props: ['input'],
            template: '<div class="render-stub">{{ input }}</div>'
          }
        }
      }
    })

    expect(wrapper.find('.banksia-unlocked').exists()).toBe(true)
    expect(wrapper.find('.render-stub').text()).toContain('Hidden member body')
    expect(wrapper.text()).toContain('Member')
    expect(wrapper.text()).toContain('Licensed to @bob · 2026-11')
    expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true)
    expect(wrapper.find('.banksia-locked').exists()).toBe(false)
  })

  it('passes unlocked HTML through the sanitising Render pipeline', async () => {
    const wrapper = mount(VaultLockedSection, {
      props: {
        metadata,
        plaintext: '<p>Sanitised member body</p><script>window.__vault_xss = true</script>',
        state: {
          status: 'unlocked',
          plaintext: '<p>Sanitised member body</p><script>window.__vault_xss = true</script>',
          period: '2026-11'
        },
        plan,
        blog: 'alice',
        readerAccount: 'bob'
      },
      global: { stubs: { 'q-skeleton': true } }
    })

    await flushPromises()
    await vi.waitFor(() => expect(wrapper.html()).toContain('Sanitised member body'))
    expect(wrapper.html()).not.toContain('<script')
    expect(globalThis.__vault_xss).toBeUndefined()
  })
})

describe('VaultPaywall', () => {
  it('shows the price, benefits and both real actions', () => {
    const wrapper = mount(VaultPaywall, {
      props: {
        plan: { author: 'alice', permlink: 'membership', priceLabel: '5.000 HBD' },
        metadata: {
          paywall: {
            title: 'Members-only',
            body: 'A subscriber essay.',
            benefits: ['Weekly essays', 'Full archive']
          }
        },
        blog: 'alice'
      }
    })

    expect(wrapper.find('h2').text()).toBe('Members-only')
    expect(wrapper.text()).toContain('5.000 HBD')
    expect(wrapper.text()).toContain('≈ $5.00 USD')
    expect(wrapper.text()).toContain('Weekly essays')
    const labels = wrapper.findAll('button').map(button => button.text())
    expect(labels.some(label => label.includes('Subscribe'))).toBe(true)
    expect(labels.some(label => label.includes('Restore access'))).toBe(true)
  })
})

describe('multi-part bulletins', () => {
  it('fetches, hash-checks and merges parts into the manifest', async () => {
    const ringKey = await randomKey()
    const keyring = { [PERIOD]: await randomKey() }
    const entries = Array.from({ length: 301 }, (_, index) => ({
      rkt: index.toString(16).padStart(16, '0'),
      alg: 'P256-HKDF-SHA256-A256GCM',
      epk: 'epk', iv: 'iv', ct: 'ct', tier: 'member',
      expires: '2026-12-21T00:00:00Z'
    }))
    const bundle = await buildVaultBulletinBundle({
      blog: BLOG, period: PERIOD, seq: 4, keyring, ringKey, entries,
      signer: BLOG, issued: '2026-11-27T12:00:00Z',
      signAdapter: { sign: async text => 'sig:' + text }
    })
    const byPermlink = new Map(bundle.parts.map(part => [part.permlink, part.part]))
    const fetchPost = async (author, permlink) => ({
      author,
      permlink,
      json_metadata: JSON.stringify({ banksia_vault_bulletin_part: byPermlink.get(permlink) })
    })
    const merged = await loadBulletinParts({ bulletin: bundle.bulletin, fetchPost })
    expect(merged.entries).toHaveLength(301)
    expect(merged.entries[300].rkt).toBe(entries[300].rkt)

    const tampered = new Map(byPermlink)
    tampered.set('vault-2026-11-4-1', { ...byPermlink.get('vault-2026-11-4-1'), entries: [] })
    const badFetch = async (author, permlink) => ({
      author,
      permlink,
      json_metadata: JSON.stringify({ banksia_vault_bulletin_part: tampered.get(permlink) })
    })
    expect(await loadBulletinParts({ bulletin: bundle.bulletin, fetchPost: badFetch })).toBeNull()
  })
})
