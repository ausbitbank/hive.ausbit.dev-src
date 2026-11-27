import { describe, expect, it } from 'vitest'
import {
  buildVaultPaywall,
  describeVaultSize,
  hasVaultMarker,
  normalizeVaultDraft,
  premiumMediaWarning,
  prepareVaultPublish,
  vaultDraftSplit,
  vaultMarkerIndex,
  vaultMetadataForEdit
} from '../../src/services/vaultCompose'
import {
  INLINE_CIPHERTEXT_MAX,
  VAULT_MARKER,
  decryptVaultParts,
  parseVaultMetadata
} from '../../src/services/vaultPayload'
import { decryptPayload } from '../../src/services/vaultCrypto'
import { createCreatorVault } from '../../src/services/vaultKeys'
import { creatorContentKey, currentVaultKid } from '../../src/services/vaultSession'
import {
  buildPostMetadata,
  buildPostOperation,
  postQueueItem,
  premiumCompanionQueueItems
} from '../../src/services/publish'
import { createDraft, normalizeDraft } from '../../src/services/drafts'

const NOW = new Date('2026-11-27T12:00:00.000Z')
const ACCOUNT = 'alice'
const PERMLINK = 'members-post'
const PASSPHRASE = 'correct horse battery'

const SETTINGS = {
  v: 1,
  enabled: true,
  product: 'alice/membership',
  container: 'banksia-vault',
  bulletin: { author: '', permlink: '' },
  price: '5.000 HBD',
  period: 'month',
  recurrence: 730,
  executions: 12,
  archive: 'all',
  watermark: true,
  updatedAt: ''
}

async function makeVault (account = ACCOUNT) {
  return createCreatorVault({ account, passphrase: PASSPHRASE, now: NOW })
}

function sectionDraft (premium) {
  return {
    title: 'A members post',
    body: 'Public teaser for everyone.\n\n' + VAULT_MARKER + premium,
    tags: ['hive', 'writing'],
    vault: { enabled: true, mode: 'section' }
  }
}

function headerFor (kid, mode = 'section', permlink = PERMLINK) {
  return { blog: ACCOUNT, permlink, kid, mode }
}

describe('normalizeVaultDraft', () => {
  it('defaults to off and section mode', () => {
    expect(normalizeVaultDraft()).toEqual({ enabled: false, mode: 'section' })
    expect(normalizeVaultDraft(null)).toEqual({ enabled: false, mode: 'section' })
    expect(normalizeVaultDraft({ enabled: 'true', mode: 'poster' }))
      .toEqual({ enabled: false, mode: 'section' })
  })

  it('keeps a valid enabled whole-post setting', () => {
    expect(normalizeVaultDraft({ enabled: true, mode: 'post' }))
      .toEqual({ enabled: true, mode: 'post' })
    expect(normalizeVaultDraft({ enabled: true, mode: 'section', kid: '2026-11' }))
      .toEqual({ enabled: true, mode: 'section' })
  })
})

describe('vault marker and draft split', () => {
  it('finds and reports the marker', () => {
    expect(vaultMarkerIndex('abc' + VAULT_MARKER + 'def')).toBe(3)
    expect(vaultMarkerIndex('plain')).toBe(-1)
    expect(hasVaultMarker('x' + VAULT_MARKER)).toBe(true)
    expect(hasVaultMarker('x')).toBe(false)
  })

  it('splits a section at the marker', () => {
    expect(vaultDraftSplit({ body: 'Teaser\n' + VAULT_MARKER + 'Premium', mode: 'section' }))
      .toEqual({ publicBody: 'Teaser\n', premiumBody: 'Premium', hasMarker: true })
  })

  it('treats a marker-less section as public text with no premium body', () => {
    expect(vaultDraftSplit({ body: 'All public', mode: 'section' }))
      .toEqual({ publicBody: 'All public', premiumBody: '', hasMarker: false })
  })

  it('encrypts the whole body in whole-post mode without a marker', () => {
    expect(vaultDraftSplit({ body: 'Whole essay', mode: 'post' }))
      .toEqual({ publicBody: '', premiumBody: 'Whole essay', hasMarker: false })
  })

  it('uses a marker in whole-post mode as the teaser boundary', () => {
    expect(vaultDraftSplit({ body: 'Teaser' + VAULT_MARKER + 'Locked', mode: 'post' }))
      .toEqual({ publicBody: 'Teaser', premiumBody: 'Locked', hasMarker: true })
  })
})

describe('buildVaultPaywall', () => {
  it('builds generic, bounded copy with the price and archive benefits', () => {
    const paywall = buildVaultPaywall(SETTINGS)
    expect(paywall.title).toBe('Members-only')
    expect(paywall.body).toContain('@alice')
    expect(paywall.body.length).toBeLessThanOrEqual(240)
    expect(paywall.benefits.length).toBeGreaterThan(0)
    expect(paywall.benefits.length).toBeLessThanOrEqual(6)
    expect(paywall.benefits.every(item => item.length <= 80)).toBe(true)
    expect(paywall.benefits.join(' ')).toContain('5.000 HBD')
    expect(paywall.benefits.join(' ')).toMatch(/archive/i)
  })

  it('falls back to a neutral blog label without a product', () => {
    const paywall = buildVaultPaywall({ archive: 'current', watermark: false })
    expect(paywall.body).toContain('this blog')
    expect(paywall.benefits.join(' ')).not.toMatch(/archive/i)
  })
})

describe('describeVaultSize', () => {
  it('reports inline, companion and too-large transports', () => {
    const small = describeVaultSize({ plaintext: 'short premium' })
    expect(small.transport).toBe('inline')
    expect(small.tone).toBe('ok')
    expect(small.ciphertextChars).toBeGreaterThan(0)

    const medium = describeVaultSize({ plaintext: 'x'.repeat(31000) })
    expect(medium.transport).toBe('comment')
    expect(medium.tone).toBe('warn')

    const tooLarge = describeVaultSize({ plaintext: 'x'.repeat(90001) })
    expect(tooLarge.transport).toBe('too-large')
    expect(tooLarge.tone).toBe('error')
    expect(tooLarge.message).toMatch(/90,000/)
  })

  it('handles empty and explicit ciphertext sizes', () => {
    expect(describeVaultSize({ plaintext: '' })).toMatchObject({
      plaintextBytes: 0,
      ciphertextChars: 0,
      transport: 'inline',
      tone: 'ok'
    })
    const explicit = describeVaultSize({ plaintext: 'abc', ciphertext: '1234567890' })
    expect(explicit.ciphertextChars).toBe(10)
  })
})

describe('premiumMediaWarning', () => {
  it('detects Markdown and HTML image URLs', () => {
    expect(premiumMediaWarning('![chart](https://example.com/chart.png)')).toBe(true)
    expect(premiumMediaWarning('![chart](/images/chart.png)')).toBe(true)
    expect(premiumMediaWarning('<img src="https://example.com/chart.png" alt="chart">')).toBe(true)
    expect(premiumMediaWarning('Text only, no images here.')).toBe(false)
    expect(premiumMediaWarning('')).toBe(false)
  })
})

describe('prepareVaultPublish', () => {
  it('encrypts a section inline and keeps the teaser public', async () => {
    const vault = await makeVault()
    const kid = currentVaultKid(NOW)
    const premium = 'Secret premium text with a [link](https://example.com).'
    const draft = sectionDraft(premium)

    const prepared = await prepareVaultPublish({
      account: ACCOUNT,
      permlink: PERMLINK,
      draft,
      vault,
      settings: SETTINGS,
      now: NOW
    })

    expect(prepared.transport).toBe('inline')
    expect(prepared.companions).toEqual([])
    expect(prepared.premiumBody).toBe(premium)
    expect(prepared.publicBody).toContain('Public teaser for everyone.')
    expect(prepared.publicBody).toContain(VAULT_MARKER)
    expect(prepared.publicBody).not.toContain('Secret premium text')

    const meta = parseVaultMetadata(prepared.vaultMetadata)
    expect(meta).toMatchObject({
      v: 1,
      mode: 'section',
      alg: 'A256GCM',
      kid,
      tier: 'member',
      product: 'alice/membership',
      container: 'banksia-vault',
      price: '5.000 HBD'
    })
    expect(meta.ct).toBe(prepared.vaultMetadata.ct)
    expect(meta.ct.length).toBeLessThanOrEqual(INLINE_CIPHERTEXT_MAX)
    expect(meta.paywall.title).toBe('Members-only')
    expect(meta.paywall.body).toContain('@alice')

    const key = creatorContentKey(vault, kid)
    const plaintext = await decryptPayload(
      { alg: meta.alg, iv: meta.iv, ct: meta.ct, hash: meta.hash },
      key,
      headerFor(kid)
    )
    expect(plaintext).toBe(premium)

    // No private key material may reach the chain.
    for (const field of ['keyring', 'ringKey', 'ringKid', 'contentKey', 'privateKey', 'passphrase']) {
      expect(meta).not.toHaveProperty(field)
    }
    expect(JSON.stringify(prepared.vaultMetadata)).not.toContain(key)
  })

  it('supports whole-post mode with only the title public', async () => {
    const vault = await makeVault()
    const kid = currentVaultKid(NOW)
    const draft = {
      title: 'Whole post',
      body: 'The entire body is members-only.',
      vault: { enabled: true, mode: 'post' }
    }

    const prepared = await prepareVaultPublish({
      account: ACCOUNT,
      permlink: 'whole-post',
      draft,
      vault,
      settings: SETTINGS,
      now: NOW
    })

    expect(prepared.publicBody).toBe('')
    expect(prepared.premiumBody).toBe('The entire body is members-only.')
    const meta = parseVaultMetadata(prepared.vaultMetadata)
    const plaintext = await decryptPayload(meta, creatorContentKey(vault, kid), headerFor(kid, 'post', 'whole-post'))
    expect(plaintext).toBe('The entire body is members-only.')
  })

  it('rejects an empty premium section with a readable error', async () => {
    const vault = await makeVault()
    await expect(prepareVaultPublish({
      account: ACCOUNT,
      permlink: PERMLINK,
      draft: { body: 'Only a public teaser', vault: { enabled: true, mode: 'section' } },
      vault,
      settings: SETTINGS,
      now: NOW
    })).rejects.toThrow('Add members-only content after the lock marker.')
  })

  it('requires an enabled, configured vault', async () => {
    const vault = await makeVault()
    await expect(prepareVaultPublish({
      account: ACCOUNT,
      permlink: PERMLINK,
      draft: sectionDraft('Secret'),
      vault,
      settings: { ...SETTINGS, enabled: false },
      now: NOW
    })).rejects.toThrow(/not enabled/i)

    await expect(prepareVaultPublish({
      account: ACCOUNT,
      permlink: PERMLINK,
      draft: sectionDraft('Secret'),
      vault,
      settings: { ...SETTINGS, product: '' },
      now: NOW
    })).rejects.toThrow(/membership product/i)

    await expect(prepareVaultPublish({
      account: ACCOUNT,
      permlink: PERMLINK,
      draft: sectionDraft('Secret'),
      vault,
      settings: { ...SETTINGS, product: 'bob/membership' },
      now: NOW
    })).rejects.toThrow(/product must belong to @alice/i)

    await expect(prepareVaultPublish({
      account: ACCOUNT,
      permlink: PERMLINK,
      draft: sectionDraft('Secret'),
      vault: null,
      settings: SETTINGS,
      now: NOW
    })).rejects.toThrow(/unlock your vault/i)
  })

  it('rejects missing content keys and mismatched accounts', async () => {
    const vault = await makeVault()
    const noKey = { ...vault, keyring: {} }
    await expect(prepareVaultPublish({
      account: ACCOUNT,
      permlink: PERMLINK,
      draft: sectionDraft('Secret'),
      vault: noKey,
      settings: SETTINGS,
      now: NOW
    })).rejects.toThrow(/no content key/i)

    await expect(prepareVaultPublish({
      account: 'bob',
      permlink: PERMLINK,
      draft: sectionDraft('Secret'),
      vault,
      settings: { ...SETTINGS, product: 'bob/membership' },
      now: NOW
    })).rejects.toThrow(/belongs to @alice/i)
  })

  it('uses companion comments above the inline ciphertext budget', async () => {
    const vault = await makeVault()
    const kid = currentVaultKid(NOW)
    const premium = 'x'.repeat(31000)
    const prepared = await prepareVaultPublish({
      account: ACCOUNT,
      permlink: 'big-post',
      draft: sectionDraft(premium),
      vault,
      settings: SETTINGS,
      now: NOW
    })

    expect(prepared.transport).toBe('comment')
    expect(prepared.companions.length).toBeGreaterThan(1)

    const meta = parseVaultMetadata(prepared.vaultMetadata)
    expect(meta.ct).toBeUndefined()
    expect(Array.isArray(meta.parts)).toBe(true)
    expect(meta.parts[0]).toBe('big-post-vault-1')
    expect(prepared.companions[0][1].permlink).toBe('big-post-vault-1')
    expect(meta.parts.length).toBe(prepared.companions.length)

    const chunks = prepared.companions.map(([, operation]) => {
      expect(operation.parent_author).toBe(ACCOUNT)
      expect(operation.parent_permlink).toBe('big-post')
      expect(operation.author).toBe(ACCOUNT)
      expect(operation.title).toBe('')
      expect(operation.body).toBe('')
      return JSON.parse(operation.json_metadata).banksia_vault_payload
    })
    const plaintext = await decryptVaultParts(chunks, creatorContentKey(vault, kid), headerFor(kid, 'section', 'big-post'))
    expect(plaintext).toBe(premium)
  })

  it('rejects payloads above the companion-comment limit', async () => {
    const vault = await makeVault()
    await expect(prepareVaultPublish({
      account: ACCOUNT,
      permlink: 'huge-post',
      draft: sectionDraft('x'.repeat(90001)),
      vault,
      settings: SETTINGS,
      now: NOW
    })).rejects.toThrow(/90,000/)
  })
})

describe('vaultMetadataForEdit', () => {
  async function preparedFixture (premium = 'Original premium') {
    const vault = await makeVault()
    const draft = sectionDraft(premium)
    const prepared = await prepareVaultPublish({
      account: ACCOUNT,
      permlink: PERMLINK,
      draft,
      vault,
      settings: SETTINGS,
      now: NOW
    })
    return { vault, draft, prepared }
  }

  it('returns null when Vault is switched off', async () => {
    const { vault, draft } = await preparedFixture()
    const result = await vaultMetadataForEdit({
      draft: { ...draft, vault: { enabled: false, mode: 'section' } },
      previousMetadata: null,
      vault,
      settings: SETTINGS,
      account: ACCOUNT,
      permlink: PERMLINK,
      now: NOW
    })
    expect(result).toBeNull()
  })

  it('preserves the previous metadata when the premium text is unchanged', async () => {
    const { vault, draft, prepared } = await preparedFixture()
    const previousMetadata = { banksia_vault: prepared.vaultMetadata }
    const result = await vaultMetadataForEdit({
      draft,
      previousMetadata,
      vault,
      settings: SETTINGS,
      account: ACCOUNT,
      permlink: PERMLINK,
      now: NOW
    })
    expect(result).toBe(prepared.vaultMetadata)
  })

  it('preserves the previous metadata for an edit that has no premium plaintext', async () => {
    const { vault, prepared } = await preparedFixture()
    const editDraft = {
      title: 'A members post',
      body: 'Public teaser for everyone.\n\n' + VAULT_MARKER,
      vault: { enabled: true, mode: 'section' },
      editing: { author: ACCOUNT, permlink: PERMLINK, previousMetadata: { banksia_vault: prepared.vaultMetadata } }
    }
    const result = await vaultMetadataForEdit({
      draft: editDraft,
      previousMetadata: { banksia_vault: prepared.vaultMetadata },
      vault,
      settings: SETTINGS,
      account: ACCOUNT,
      permlink: PERMLINK,
      now: NOW
    })
    expect(result).toBe(prepared.vaultMetadata)
  })

  it('re-encrypts with a new IV when the premium text changed', async () => {
    const { vault, prepared } = await preparedFixture()
    const changed = sectionDraft('A different premium payload')
    const result = await vaultMetadataForEdit({
      draft: changed,
      previousMetadata: { banksia_vault: prepared.vaultMetadata },
      vault,
      settings: SETTINGS,
      account: ACCOUNT,
      permlink: PERMLINK,
      now: NOW
    })
    expect(result).not.toEqual(prepared.vaultMetadata)
    expect(result.iv).not.toBe(prepared.vaultMetadata.iv)
    expect(result.hash).not.toBe(prepared.vaultMetadata.hash)
  })

  it('can return the publish details for the edit flow', async () => {
    const { vault, draft } = await preparedFixture()
    const decision = await vaultMetadataForEdit({
      draft,
      previousMetadata: null,
      vault,
      settings: SETTINGS,
      account: ACCOUNT,
      permlink: PERMLINK,
      now: NOW,
      withDetails: true
    })
    expect(decision.unchanged).toBe(false)
    expect(decision.publicBody).toContain(VAULT_MARKER)
    expect(decision.premiumBody).toBe('Original premium')

    const unchanged = await vaultMetadataForEdit({
      draft: { ...draft, body: 'Public teaser for everyone.\n\n' + VAULT_MARKER },
      previousMetadata: { banksia_vault: decision.vaultMetadata },
      vault,
      settings: SETTINGS,
      account: ACCOUNT,
      permlink: PERMLINK,
      now: NOW,
      withDetails: true
    })
    expect(unchanged.unchanged).toBe(true)
    expect(unchanged.vaultMetadata).toEqual(decision.vaultMetadata)
    expect(unchanged.companions).toEqual([])
  })

  it('preserves whole-post mode teaser edits instead of encrypting the teaser', async () => {
    const vault = await makeVault()
    const original = await prepareVaultPublish({
      account: ACCOUNT,
      permlink: 'whole-post-edit',
      draft: { title: 'W', body: 'The locked body', vault: { enabled: true, mode: 'post' } },
      vault,
      settings: SETTINGS,
      now: NOW
    })
    const editDraft = {
      title: 'W',
      body: 'A newly written public teaser',
      vault: { enabled: true, mode: 'post' },
      editing: { author: ACCOUNT, permlink: 'whole-post-edit' }
    }
    const result = await vaultMetadataForEdit({
      draft: editDraft,
      previousMetadata: { banksia_vault: original.vaultMetadata },
      vault,
      settings: SETTINGS,
      account: ACCOUNT,
      permlink: 'whole-post-edit',
      now: NOW
    })
    expect(result).toBe(original.vaultMetadata)
  })
})

describe('publish metadata integration', () => {
  const draft = { title: 'A post', body: 'Public body', tags: ['hive'] }
  const vaultMetadata = { v: 1, mode: 'section', alg: 'A256GCM' }

  function metadataOf (operation) {
    return JSON.parse(operation[1].json_metadata)
  }

  it('adds banksia_vault only when supplied', () => {
    expect(buildPostMetadata(draft)).not.toHaveProperty('banksia_vault')
    expect(buildPostMetadata(draft, { vaultMetadata })).toMatchObject({ banksia_vault: vaultMetadata })
    expect(buildPostMetadata(draft, { vaultMetadata: null })).not.toHaveProperty('banksia_vault')
  })

  it('sets banksia_vault from buildPostOperation', () => {
    const operation = buildPostOperation({
      username: ACCOUNT,
      draft,
      permlink: 'publish-one',
      vaultMetadata
    })
    expect(metadataOf(operation).banksia_vault).toEqual(vaultMetadata)
  })

  it('strips members-only plaintext from the published body', () => {
    const premiumDraft = {
      ...draft,
      body: 'Public teaser\n\n<!--banksia:vault-->\nThe members-only secret.'
    }
    const operation = buildPostOperation({
      username: ACCOUNT,
      draft: premiumDraft,
      permlink: 'publish-one',
      vaultMetadata
    })
    expect(operation[1].body).toBe('Public teaser\n\n<!--banksia:vault-->')
    expect(operation[1].body).not.toContain('members-only secret')
  })

  it('publishes no body for a whole-post payload without a marker', () => {
    const operation = buildPostOperation({
      username: ACCOUNT,
      draft: { ...draft, body: 'The whole essay is locked.' },
      permlink: 'publish-one',
      vaultMetadata: { ...vaultMetadata, mode: 'post' }
    })
    expect(operation[1].body).toBe('')
  })

  it('preserves a previous banksia_vault when no decision is supplied', () => {
    const previousMetadata = {
      banksia_vault: { v: 1, mode: 'section', kid: '2026-11', iv: 'old', ct: 'old' },
      description: 'Written by another client'
    }
    const operation = buildPostOperation({
      username: ACCOUNT,
      draft,
      permlink: 'publish-one',
      previousMetadata
    })
    expect(metadataOf(operation).banksia_vault).toEqual(previousMetadata.banksia_vault)
  })

  it('removes banksia_vault when the decision is null', () => {
    const previousMetadata = {
      banksia_vault: { v: 1, mode: 'section', kid: '2026-11', iv: 'old', ct: 'old' },
      custom_key: 'keep me'
    }
    const operation = buildPostOperation({
      username: ACCOUNT,
      draft,
      permlink: 'publish-one',
      previousMetadata,
      vaultMetadata: null
    })
    const metadata = metadataOf(operation)
    expect(metadata).not.toHaveProperty('banksia_vault')
    expect(metadata.custom_key).toBe('keep me')
  })

  it('replaces a previous banksia_vault with a re-encrypted one', () => {
    const previousMetadata = {
      banksia_vault: { v: 1, mode: 'section', kid: '2026-10', iv: 'old', ct: 'old' }
    }
    const operation = buildPostOperation({
      username: ACCOUNT,
      draft,
      permlink: 'publish-one',
      previousMetadata,
      vaultMetadata
    })
    expect(metadataOf(operation).banksia_vault).toEqual(vaultMetadata)
  })

  it('derives metadata from the public teaser, not the locked payload', () => {
    const premiumDraft = {
      title: 'A members post',
      body: 'A public teaser line.\n\n' + VAULT_MARKER + [
        'Secret body text.',
        '![private chart](https://example.com/private-chart.png)',
        'Thanks @secretmention.'
      ].join('\n'),
      tags: ['hive']
    }
    const operation = buildPostOperation({
      username: ACCOUNT,
      draft: premiumDraft,
      permlink: 'publish-one',
      vaultMetadata
    })
    const metadata = metadataOf(operation)
    expect(metadata.description).toContain('A public teaser line.')
    expect(metadata.description).not.toContain('Secret body text')
    expect(metadata.description).not.toContain('banksia:vault')
    expect(metadata.image || []).not.toContain('https://example.com/private-chart.png')
    expect(metadata.users || []).not.toContain('secretmention')
  })

  it('leaves a normal post byte-for-byte free of vault keys', () => {
    const operation = buildPostOperation({ username: ACCOUNT, draft, permlink: 'normal-post' })
    const metadata = metadataOf(operation)
    expect(metadata).not.toHaveProperty('banksia_vault')
    expect(operation[1].body).toBe('Public body')
  })

  it('passes vaultMetadata through postQueueItem', () => {
    const item = postQueueItem({
      username: ACCOUNT,
      draft,
      permlink: 'publish-one',
      vaultMetadata
    })
    expect(item[0]).toBe(ACCOUNT)
    expect(item[1]).toBe('posting')
    expect(JSON.parse(item[2][1].json_metadata).banksia_vault).toEqual(vaultMetadata)
  })

  it('wraps companions as posting queue items under the same parent', () => {
    const companions = [
      ['comment', {
        parent_author: ACCOUNT,
        parent_permlink: 'publish-one',
        author: ACCOUNT,
        permlink: 'vault-payload-1',
        title: '',
        body: '',
        json_metadata: '{"app":"banksia.io"}'
      }]
    ]
    const items = premiumCompanionQueueItems({ account: ACCOUNT, permlink: 'publish-one', companions })
    expect(items).toHaveLength(1)
    expect(items[0][0]).toBe(ACCOUNT)
    expect(items[0][1]).toBe('posting')
    expect(items[0][2][0]).toBe('comment')
    expect(items[0][2][1].permlink).toBe('vault-payload-1')
    expect(items[0][2][1].parent_permlink).toBe('publish-one')
  })
})

describe('draft vault round-trip', () => {
  it('defaults to off and section mode', () => {
    expect(normalizeDraft({}).vault).toEqual({ enabled: false, mode: 'section' })
    expect(createDraft({}).vault).toEqual({ enabled: false, mode: 'section' })
  })

  it('round-trips enabled whole-post drafts', () => {
    const normalized = normalizeDraft({ vault: { enabled: true, mode: 'post' } })
    expect(normalized.vault).toEqual({ enabled: true, mode: 'post' })
    const created = createDraft({ vault: { enabled: true, mode: 'post' } })
    expect(created.vault).toEqual({ enabled: true, mode: 'post' })
  })

  it('normalises an unknown mode back to section', () => {
    expect(normalizeDraft({ vault: { enabled: true, mode: 'everything' } }).vault)
      .toEqual({ enabled: true, mode: 'section' })
  })
})
