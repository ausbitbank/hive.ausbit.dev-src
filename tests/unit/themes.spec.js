import { describe, expect, it } from 'vitest'
import { contrast, ensureContrast, hslToHex, mix, parseHex } from '../../src/themes/color'
import { THEMES, getTheme, DEFAULT_THEME_ID } from '../../src/themes/registry'
import { highContrastTokens, tokensFor } from '../../src/themes/tokens'
import {
  MAX_THEME_BYTES,
  THEME_SCHEMA,
  parseTheme,
  validateTheme
} from '../../src/themes/schema'
import {
  THEME_NAMESPACE,
  buildThemeOperation,
  mergeThemeMetadata,
  readAccountTheme,
  removeThemeMetadata,
  themeFromPostingMetadata
} from '../../src/themes/account'

function profileTheme (overrides = {}) {
  const base = getTheme('neon-tide')
  return {
    schema: THEME_SCHEMA,
    scope: 'profile',
    id: 'alice-skin',
    name: 'Alice skin',
    mood: 'A test skin',
    description: 'A theme used by the unit tests.',
    author: 'alice',
    remixedFrom: null,
    tags: ['dark', 'test'],
    mode: 'dark',
    tokens: { ...base.tokens },
    type: { ...base.type },
    shape: { ...base.shape },
    effects: { ...base.effects },
    profile: {
      background: 'mesh',
      avatarFrame: 'ring',
      nameplate: 'gradient',
      card: 'glass',
      ticker: 'Hello Hive',
      stickers: ['hex', 'star'],
      banner: null
    },
    ...overrides
  }
}

describe('theme colour maths', () => {
  it('parses hex and mixes colours', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseHex('#123456')).toEqual({ r: 18, g: 52, b: 86 })
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('measures contrast and can repair a failing pair', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 0)
    expect(contrast('#777777', '#777777')).toBe(1)
    expect(contrast(ensureContrast('#777777', '#777777', 4.5), '#777777')).toBeGreaterThanOrEqual(4.5)
  })

  it('generates deterministic HSL hex values', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000')
    expect(hslToHex(120, 100, 50)).toBe('#00ff00')
  })
})

describe('built-in themes', () => {
  it('ships Hive Dark as the default', () => {
    expect(DEFAULT_THEME_ID).toBe('hive-dark')
    expect(getTheme('not-a-theme').id).toBe('hive-dark')
  })

  it('keeps body and muted text at AA contrast in every theme', () => {
    for (const theme of THEMES) {
      expect(contrast(theme.tokens.text, theme.tokens.surface), theme.id).toBeGreaterThanOrEqual(4.5)
      expect(contrast(theme.tokens.muted, theme.tokens.surface), theme.id).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('derives a full token set for every theme', () => {
    for (const theme of THEMES) {
      const tokens = tokensFor(theme)
      expect(tokens['--c-bg'], theme.id).toBeTruthy()
      expect(tokens['--c-text'], theme.id).toBeTruthy()
      expect(tokens['--c-link'], theme.id).toBeTruthy()
      expect(tokens['--c-border-subtle'], theme.id).toBeTruthy()
    }
  })

  it('applies a high-contrast override without mutating the theme', () => {
    const theme = getTheme('honeycomb')
    const normal = tokensFor(theme)
    const high = tokensFor(theme, { highContrast: true })
    expect(high['--c-bg']).not.toBe(normal['--c-bg'])
    expect(high['--c-text']).toBe('#ffffff')
    expect(highContrastTokens('light')['--c-bg']).toBe('#ffffff')
  })
})

describe('theme schema', () => {
  it('accepts a valid profile theme and migrates the legacy ticker', () => {
    const result = validateTheme(profileTheme(), { requireProfile: true })
    expect(result.ok).toBe(true)
    expect(result.theme.profile.ticker).toBeUndefined()
    expect(result.theme.profile.status).toEqual({ text: 'Hello Hive', icon: 'none' })
    expect(result.legacy.ticker).toBe(true)
  })

  it('accepts a static status line with a closed icon enum', () => {
    const input = profileTheme()
    input.profile.status = { text: 'Building a Hive dashboard', icon: 'hammer' }
    const result = validateTheme(input)
    expect(result.ok).toBe(true)
    expect(result.theme.profile.status).toEqual({ text: 'Building a Hive dashboard', icon: 'hammer' })

    const badIcon = profileTheme()
    badIcon.profile.status = { text: 'Hi', icon: 'rocket' }
    expect(validateTheme(badIcon).ok).toBe(false)
  })

  it('rejects HTML, URLs and overlong status text', () => {
    for (const text of ['<b>Hello</b>', 'Visit https://example.com', 'x'.repeat(81)]) {
      const input = profileTheme()
      input.profile.status = { text, icon: 'none' }
      expect(validateTheme(input).ok, text).toBe(false)
    }
  })

  it('accepts legacy stickers but never returns or renders them', () => {
    const input = profileTheme()
    input.profile.stickers = ['hex', 'star']
    const result = validateTheme(input)
    expect(result.ok).toBe(true)
    expect(result.theme.profile.stickers).toBeUndefined()
    expect(result.legacy.stickers).toBe(true)
    expect(result.warnings.join(' ')).toContain('Legacy stickers')
  })

  it('validates and dedupes the Hive Circle', () => {
    const input = profileTheme()
    input.profile.circle = ['alice', 'bob', 'alice', 'carol', 'dave', 'erin', 'frank', 'grace']
    expect(validateTheme(input).ok).toBe(false)

    const valid = profileTheme()
    valid.profile.circle = ['alice', 'bob', 'alice', 'carol']
    const result = validateTheme(valid)
    expect(result.ok).toBe(true)
    expect(result.theme.profile.circle).toEqual(['alice', 'bob', 'carol'])

    const invalid = profileTheme()
    invalid.profile.circle = ['A', 'not a name', 'alice']
    expect(validateTheme(invalid).ok).toBe(false)
  })

  it('validates the latest or pinned post module', () => {
    for (const value of ['latest', 'pinned', 'none']) {
      const input = profileTheme()
      input.profile.post = value
      expect(validateTheme(input).theme.profile.post).toBe(value)
    }
    const input = profileTheme()
    input.profile.post = 'random'
    expect(validateTheme(input).ok).toBe(false)
  })

  it('rejects a site-scoped theme as an account skin', () => {
    const input = profileTheme({ scope: 'site' })
    const result = validateTheme(input, { requireProfile: true })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('scope must be "profile"')
  })

  it('rejects unknown keys instead of silently dropping them', () => {
    const input = profileTheme()
    input.tokens.backgroundImage = 'url(https://evil.example/pixel)'
    const result = validateTheme(input)
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('not a recognised theme field')
  })

  it('rejects CSS injection values and non-hex colours', () => {
    for (const value of [
      '#fff; background:url(https://evil.example/pixel)',
      'url(javascript:alert(1))',
      'var(--q-primary)',
      'red',
      'rgb(1,2,3)',
      '#12345'
    ]) {
      const input = profileTheme()
      input.tokens.primary = value
      expect(validateTheme(input).ok, value).toBe(false)
    }
  })

  it('rejects prototype keys and oversized or deeply nested input', () => {
    const proto = profileTheme()
    Object.defineProperty(proto, '__proto__', { value: { polluted: true }, enumerable: true })
    expect(validateTheme(proto).ok).toBe(false)

    const huge = profileTheme({ description: 'x'.repeat(MAX_THEME_BYTES) })
    expect(validateTheme(huge).ok).toBe(false)

    const deep = profileTheme()
    deep.profile.banner = { layout: 'mosaic', images: [], extra: { a: { b: { c: { d: 1 } } } } }
    expect(validateTheme(deep).ok).toBe(false)
  })

  it('rejects low-contrast text and unsafe media', () => {
    const low = profileTheme()
    low.tokens.text = low.tokens.surface
    expect(validateTheme(low).ok).toBe(false)

    const media = profileTheme()
    media.profile.banner = { layout: 'mosaic', images: ['http://evil.example/a.png'] }
    expect(validateTheme(media).ok).toBe(false)

    const stickers = profileTheme()
    stickers.profile.stickers = ['hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex']
    expect(validateTheme(stickers).ok).toBe(false)
  })

  it('rejects HTML in the ticker and bidi control characters in display strings', () => {
    const ticker = profileTheme()
    ticker.profile.ticker = '<script>alert(1)</script>'
    const result = validateTheme(ticker)
    expect(result.ok).toBe(false)

    const bidi = profileTheme({ name: 'safe\u202eevil' })
    expect(validateTheme(bidi).ok).toBe(false)
  })

  it('parses valid JSON without throwing on malformed input', () => {
    expect(parseTheme('{').ok).toBe(false)
    expect(parseTheme(JSON.stringify(profileTheme())).ok).toBe(true)
  })
})

describe('account theme metadata', () => {
  it('reads a theme from the namespaced top-level key', () => {
    const raw = JSON.stringify({
      profile: { name: 'Alice' },
      [THEME_NAMESPACE]: { theme: profileTheme() }
    })
    const result = themeFromPostingMetadata(raw)
    expect(result.theme.name).toBe('Alice skin')
  })

  it('ignores malformed metadata and invalid themes', () => {
    expect(themeFromPostingMetadata('{').theme).toBeNull()
    expect(themeFromPostingMetadata(JSON.stringify({ profile: {} })).theme).toBeNull()
    expect(themeFromPostingMetadata(JSON.stringify({ [THEME_NAMESPACE]: { theme: { schema: 'nope' } } })).theme).toBeNull()
  })

  it('preserves unrelated profile metadata when merging', () => {
    const raw = JSON.stringify({
      profile: { name: 'Alice', about: 'Hello' },
      custom: { keep: true }
    })
    const merged = mergeThemeMetadata(raw, profileTheme())
    expect(merged.ok).toBe(true)
    const value = JSON.parse(merged.text)
    expect(value.profile).toEqual({ name: 'Alice', about: 'Hello' })
    expect(value.custom).toEqual({ keep: true })
    expect(value[THEME_NAMESPACE].theme.name).toBe('Alice skin')
  })

  it('removes only the theme key when unpublishing', () => {
    const raw = JSON.stringify({
      profile: { name: 'Alice' },
      [THEME_NAMESPACE]: { theme: profileTheme(), other: true }
    })
    const removed = removeThemeMetadata(raw)
    const value = JSON.parse(removed.text)
    expect(value[THEME_NAMESPACE]).toEqual({ other: true })
    expect(value.profile.name).toBe('Alice')
  })

  it('refuses to merge over malformed metadata', () => {
    expect(mergeThemeMetadata('{', profileTheme()).ok).toBe(false)
  })

  it('builds a posting-only account_update2 with empty legacy metadata', () => {
    const account = { name: 'alice', json_metadata: '{"legacy":true}' }
    const operation = buildThemeOperation(account, '{"profile":{}}')
    expect(operation[0]).toBe('account_update2')
    expect(operation[1]).toMatchObject({
      account: 'alice',
      // Empty means "leave unchanged"; sending the old value back would
      // escalate the operation to active authority.
      json_metadata: '',
      posting_json_metadata: '{"profile":{}}'
    })
    expect(operation[1].extensions).toEqual([])
    expect(operation[1].owner).toBeUndefined()
    expect(operation[1].active).toBeUndefined()
    expect(operation[1].posting).toBeUndefined()
    expect(operation[1].memo_key).toBeUndefined()
  })

  it('returns a safe empty result for a missing account', () => {
    expect(readAccountTheme(null).theme).toBeNull()
  })
})
