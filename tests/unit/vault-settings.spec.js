import { describe, expect, it } from 'vitest'
import {
  VAULT_DEFAULT_PRICE,
  VAULT_MAX_BYTES
} from '../../src/config/blog'
import {
  defaultBlogSettings,
  normalizeBlogSettings,
  readBlogSettings
} from '../../src/services/blogSettings'
import {
  buildVaultSettingsPatch,
  defaultVaultSettings,
  formatVaultPrice,
  normalizeVaultSettings,
  readVaultSettings,
  vaultIsConfigured,
  vaultPriceValue,
  vaultProductRef
} from '../../src/services/vaultSettings'

const NOW = '2026-11-27T12:00:00.000Z'

const VALID_VAULT = {
  v: 1,
  enabled: true,
  product: 'alice/membership',
  container: 'banksia-vault',
  bulletin: { author: 'alice', permlink: 'vault-2026-11-3' },
  price: '5.000 HBD',
  period: 'month',
  recurrence: 730,
  executions: 12,
  archive: 'all',
  watermark: true,
  productTitle: 'Notes from the garden',
  productDescription: 'Weekly essays, field notes and the full archive.',
  benefits: ['Weekly essays', 'Full archive'],
  updatedAt: '2026-11-27T00:00:00.000Z'
}

function accountWith (vault, { claimed = true } = {}) {
  const blog = { version: 1, claimed, title: 'Alice writes' }
  if (vault !== undefined) blog.vault = vault
  return {
    name: 'alice',
    posting_json_metadata: JSON.stringify({ profile: { name: 'Alice' }, 'banksia.io': { blog } }),
    json_metadata: ''
  }
}

describe('vault settings defaults', () => {
  it('returns the documented default object', () => {
    expect(defaultVaultSettings()).toEqual({
      v: 1,
      enabled: false,
      product: '',
      container: 'banksia-vault',
      bulletin: { author: '', permlink: '' },
      price: '5.000 HBD',
      period: 'month',
      recurrence: 730,
      executions: 12,
      archive: 'all',
      watermark: true,
      productTitle: '',
      productDescription: '',
      benefits: [],
      updatedAt: ''
    })
    expect(defaultVaultSettings({ name: 'alice' })).toEqual(defaultVaultSettings())
  })

  it('normalises an omitted object into defaults stamped with now', () => {
    const result = normalizeVaultSettings(undefined, { now: NOW })
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.settings).toEqual({ ...defaultVaultSettings(), updatedAt: NOW })
  })
})

describe('normalizeVaultSettings', () => {
  it('accepts an enabled, fully configured vault', () => {
    const result = normalizeVaultSettings(VALID_VAULT, { now: NOW })
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.settings).toEqual(VALID_VAULT)
    expect(vaultIsConfigured(result.settings)).toBe(true)
    expect(vaultProductRef(result.settings)).toBe('alice/membership')
  })

  it('rejects unknown fields instead of warning about them', () => {
    const result = normalizeVaultSettings({ ...VALID_VAULT, surprise: true }, { now: NOW })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('vault.surprise is not a recognised field')
    expect(result.warnings).toEqual([])
  })

  it('rejects private key and token material', () => {
    const result = normalizeVaultSettings({
      enabled: false,
      secret_key: '5Kabc',
      nested: { token: 'abc' }
    }, { now: NOW })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('must not contain private key or token material')
  })

  it('rejects bad prices', () => {
    for (const price of ['5 HBD', '5.00 HBD', '0.000 HBD', '100001.000 HBD', 5]) {
      const result = normalizeVaultSettings({ ...VALID_VAULT, price }, { now: NOW })
      expect(result.ok, String(price)).toBe(false)
      expect(result.errors.join(' ')).toContain('vault.price')
    }
  })

  it('canonicalises leading zeros in a valid price', () => {
    const result = normalizeVaultSettings({ ...VALID_VAULT, price: '005.000 HBD' }, { now: NOW })
    expect(result.ok).toBe(true)
    expect(result.settings.price).toBe('5.000 HBD')
  })

  it('rejects out-of-range recurrence and executions', () => {
    for (const recurrence of [12, 9000, 730.5, '730']) {
      const result = normalizeVaultSettings({ ...VALID_VAULT, recurrence }, { now: NOW })
      expect(result.ok, String(recurrence)).toBe(false)
      expect(result.errors.join(' ')).toContain('vault.recurrence must be an integer between 24 and 8760')
    }
    for (const executions of [1, 121, 12.5, '12']) {
      const result = normalizeVaultSettings({ ...VALID_VAULT, executions }, { now: NOW })
      expect(result.ok, String(executions)).toBe(false)
      expect(result.errors.join(' ')).toContain('vault.executions must be an integer between 2 and 120')
    }
  })

  it('normalises product copy and benefits', () => {
    const result = normalizeVaultSettings({
      ...VALID_VAULT,
      productTitle: '  Garden notes  ',
      productDescription: 'Essays and field notes.\nNew issue every week.',
      benefits: [' Weekly essays ', 'Weekly essays', '', 'Full archive']
    }, { now: NOW })
    expect(result.ok).toBe(true)
    expect(result.settings.productTitle).toBe('Garden notes')
    expect(result.settings.productDescription).toContain('Essays and field notes.')
    expect(result.settings.benefits).toEqual(['Weekly essays', 'Full archive'])
  })

  it('rejects HTML in product copy and too many benefits', () => {
    const html = normalizeVaultSettings({ ...VALID_VAULT, productTitle: '<b>Hi</b>' }, { now: NOW })
    expect(html.ok).toBe(false)
    expect(html.errors.join(' ')).toContain('plain text')
    const many = normalizeVaultSettings({
      ...VALID_VAULT,
      benefits: ['1','2','3','4','5','6','7']
    }, { now: NOW })
    expect(many.ok).toBe(false)
    expect(many.errors.join(' ')).toContain('at most 6')
  })

  it('rejects an unknown archive policy and period', () => {
    const archive = normalizeVaultSettings({ ...VALID_VAULT, archive: 'everything' }, { now: NOW })
    expect(archive.ok).toBe(false)
    expect(archive.errors.join(' ')).toContain('vault.archive must be one of: all, current')

    const period = normalizeVaultSettings({ ...VALID_VAULT, period: 'year' }, { now: NOW })
    expect(period.ok).toBe(false)
    expect(period.errors.join(' ')).toContain('vault.period must be "month"')
  })

  it('requires a product when the vault is enabled', () => {
    const result = normalizeVaultSettings({ ...VALID_VAULT, product: '' }, { now: NOW })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('vault.product is required when vault.enabled is true')
    expect(vaultIsConfigured(result.settings)).toBe(false)
  })

  it('rejects a malformed product reference and container', () => {
    const product = normalizeVaultSettings({ ...VALID_VAULT, product: 'alice' }, { now: NOW })
    expect(product.ok).toBe(false)
    expect(product.errors.join(' ')).toContain('vault.product must be "author/permlink"')

    const container = normalizeVaultSettings({ ...VALID_VAULT, container: 'Not A Permlink!' }, { now: NOW })
    expect(container.ok).toBe(false)
    expect(container.errors.join(' ')).toContain('vault.container must be a permlink')
  })

  it('rejects a malformed bulletin pair', () => {
    const half = normalizeVaultSettings({
      ...VALID_VAULT,
      bulletin: { author: 'alice', permlink: '' }
    }, { now: NOW })
    expect(half.ok).toBe(false)
    expect(half.errors.join(' ')).toContain('vault.bulletin must set both author and permlink')

    const permlink = normalizeVaultSettings({
      ...VALID_VAULT,
      bulletin: { author: 'alice', permlink: 'not-a-bulletin' }
    }, { now: NOW })
    expect(permlink.ok).toBe(false)
    expect(permlink.errors.join(' ')).toContain('vault.bulletin.permlink must look like vault-2026-11-3')
  })

  it('rejects a v other than 1 and non-boolean flags', () => {
    const result = normalizeVaultSettings({
      ...VALID_VAULT,
      v: 2,
      enabled: 'yes',
      watermark: 'on'
    }, { now: NOW })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('vault.v must be 1')
    expect(result.errors.join(' ')).toContain('vault.enabled must be a boolean')
    expect(result.errors.join(' ')).toContain('vault.watermark must be a boolean')
  })

  it('rejects a vault blob over the byte budget', () => {
    expect(VAULT_MAX_BYTES).toBe(1200)
    const result = normalizeVaultSettings({
      enabled: false,
      padding: 'x'.repeat(VAULT_MAX_BYTES)
    }, { now: NOW })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('vault must be 1200 bytes or fewer')
  })

  it('keeps a valid maximum-size object under the cap', () => {
    const result = normalizeVaultSettings({
      ...VALID_VAULT,
      product: 'alice/' + 'a'.repeat(250),
      container: 'b'.repeat(256),
      bulletin: { author: 'alice', permlink: 'vault-2026-11-' + '1'.repeat(240) },
      price: '100000.000 HBD',
      recurrence: 8760,
      executions: 120,
      archive: 'current'
    }, { now: NOW })
    expect(result.ok).toBe(true)
    expect(JSON.stringify(result.settings).length).toBeLessThanOrEqual(VAULT_MAX_BYTES)
  })

  it('builds a patch containing only known fields', () => {
    const patch = buildVaultSettingsPatch({ ...VALID_VAULT, junk: true })
    expect(Object.keys(patch).sort()).toEqual(Object.keys(defaultVaultSettings()).sort())
    expect(patch.product).toBe('alice/membership')
    expect(patch.junk).toBeUndefined()
  })
})

describe('price helpers', () => {
  it('formats numbers and strings as X.XXX HBD', () => {
    expect(formatVaultPrice(5)).toBe('5.000 HBD')
    expect(formatVaultPrice(5.5)).toBe('5.500 HBD')
    expect(formatVaultPrice('5.000 HBD')).toBe('5.000 HBD')
    expect(formatVaultPrice('5.5 HBD')).toBe('5.500 HBD')
    expect(formatVaultPrice('-1 HBD')).toBeNull()
    expect(formatVaultPrice('lots')).toBeNull()
    expect(vaultPriceValue('5.001 HBD')).toBe(5.001)
    expect(vaultPriceValue('nope')).toBeNull()
  })
})

describe('reading vault settings from chain metadata', () => {
  it('reads a valid vault and reports it enabled', () => {
    const read = readVaultSettings(accountWith(VALID_VAULT))
    expect(read.enabled).toBe(true)
    expect(read.error).toBe('')
    expect(read.settings.product).toBe('alice/membership')
  })

  it('does not enable a malformed vault', () => {
    const read = readVaultSettings(accountWith({ ...VALID_VAULT, price: 'free' }))
    expect(read.enabled).toBe(false)
    expect(read.error).toContain('vault.price')
    expect(read.settings.enabled).toBe(true)
  })

  it('returns defaults when the vault is absent or the account is missing', () => {
    const absent = readVaultSettings(accountWith(undefined))
    expect(absent.enabled).toBe(false)
    expect(absent.error).toBe('')
    expect(absent.settings.product).toBe('')
    expect(absent.settings.price).toBe(VAULT_DEFAULT_PRICE)
    expect(absent.settings.updatedAt).toBe('')

    const missing = readVaultSettings(null)
    expect(missing.enabled).toBe(false)
    expect(missing.error).toBe('Account is not loaded')
  })

  it('reads the legacy namespace', () => {
    const account = {
      name: 'alice',
      posting_json_metadata: JSON.stringify({
        'hive.ausbit.dev': { blog: { version: 1, claimed: true, vault: VALID_VAULT } }
      })
    }
    expect(readVaultSettings(account).enabled).toBe(true)
  })
})

describe('blog settings integration', () => {
  it('includes vault defaults in defaultBlogSettings', () => {
    expect(defaultBlogSettings(accountWith(VALID_VAULT)).vault).toEqual(defaultVaultSettings())
  })

  it('round-trips a full blog object with an enabled vault', () => {
    const first = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'Alice writes',
      vault: VALID_VAULT
    }, { account: accountWith(VALID_VAULT) })
    expect(first.ok).toBe(true)
    expect(first.errors).toEqual([])
    expect(first.settings.vault).toEqual(VALID_VAULT)

    const second = normalizeBlogSettings(first.settings, { account: accountWith(VALID_VAULT) })
    expect(second.ok).toBe(true)
    expect(second.settings.vault).toEqual(first.settings.vault)
  })

  it('surfaces an enabled vault without a product as a blog error', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x',
      vault: { ...VALID_VAULT, product: '' }
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('vault.product is required when vault.enabled is true')
  })

  it('ignores a malformed relay certificate without disabling Vault', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x',
      vault: { ...VALID_VAULT, relay: { delegate: 'p256:abc' } }
    })
    expect(result.ok).toBe(true)
    expect(result.settings.vault.relay).toBeUndefined()
    expect(result.warnings.join(' ')).toContain('relay certificate ignored')
  })

  it('accepts a structurally valid relay certificate', () => {
    const relay = {
      v: 1,
      id: 'banksia.vault.delegate',
      blog: 'alice',
      delegate_account: 'alice-relay',
      delegate: 'STM1111111111111111111111111111111111111111',
      scope: ['grant', 'bulletin'],
      notBefore: '2026-11-28T00:00:00.000Z',
      notAfter: '2027-02-28T00:00:00.000Z',
      nonce: 'abcdefghijklmnopqrstuvwx',
      sig: 'a'.repeat(130)
    }
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x',
      vault: { ...VALID_VAULT, relay }
    })
    expect(result.ok).toBe(true)
    expect(result.settings.vault.relay).toEqual(relay)
  })

  it('reads vault settings through readBlogSettings', () => {
    const read = readBlogSettings(accountWith(VALID_VAULT))
    expect(read.claimed).toBe(true)
    expect(read.settings.vault.enabled).toBe(true)
    expect(read.settings.vault.product).toBe('alice/membership')
  })

})
