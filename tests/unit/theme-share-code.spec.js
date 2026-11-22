import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTheme } from '../../src/themes/registry'
import { THEME_SCHEMA } from '../../src/themes/schema'
import { CODE_PREFIX, decodeThemeCode, encodeThemeCode } from '../../src/themes/shareCode'

function codeForProfile (preset) {
  return {
    schema: THEME_SCHEMA,
    scope: 'profile',
    id: 'share-code-test',
    name: 'Share code test',
    mood: 'A share-code fixture',
    description: 'Used by the share-code unit tests.',
    author: 'alice',
    remixedFrom: null,
    tags: ['dark', 'test'],
    mode: preset.mode,
    tokens: { ...preset.tokens },
    type: { ...preset.type },
    shape: { ...preset.shape },
    effects: { ...preset.effects },
    profile: {
      background: 'mesh',
      avatarFrame: 'ring',
      nameplate: 'gradient',
      card: 'glass',
      status: { text: 'Sharing a skin', icon: 'spark' },
      circle: ['bob'],
      badges: { selected: [{ source: 'peakd', id: 'badge-069069' }], showLevel: true },
      post: 'latest',
      atmosphere: { source: 'cover', treatment: 'duotone', intensity: 'medium' },
      visual: { link: 'glow', button: 'pill', chip: 'stamp', divider: 'hex', image: 'rounded', gradient: 'diagonal' },
      banner: null
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('theme share codes', () => {
  it('round-trips a validated profile theme', async () => {
    const theme = codeForProfile(getTheme('neon-tide'))
    const code = await encodeThemeCode(theme)
    expect(code.startsWith(CODE_PREFIX)).toBe(true)
    const decoded = await decodeThemeCode(code)
    expect(decoded.ok).toBe(true)
    expect(decoded.theme.name).toBe(theme.name)
    expect(decoded.theme.tokens).toEqual(theme.tokens)
  })

  it('falls back to plain JSON base64url when compression is unavailable', async () => {
    vi.stubGlobal('CompressionStream', undefined)
    const theme = codeForProfile(getTheme('hive-light'))
    const code = await encodeThemeCode(theme)
    expect(code.startsWith(CODE_PREFIX + 'j:')).toBe(true)
    const decoded = await decodeThemeCode(code)
    expect(decoded.ok).toBe(true)
    expect(decoded.theme.name).toBe(theme.name)
  })

  it('rejects malformed and oversized codes', async () => {
    expect((await decodeThemeCode('')).ok).toBe(false)
    expect((await decodeThemeCode('hello')).ok).toBe(false)
    expect((await decodeThemeCode(CODE_PREFIX + 'x:abc')).ok).toBe(false)
    expect((await decodeThemeCode(CODE_PREFIX + 'j:not-base64')).ok).toBe(false)
    expect((await decodeThemeCode(CODE_PREFIX + 'j:' + 'a'.repeat(20000))).ok).toBe(false)
  })

  it('validates the decoded theme instead of trusting it', async () => {
    const theme = codeForProfile(getTheme('neon-tide'))
    theme.tokens.primary = 'url(javascript:alert(1))'
    const code = await encodeThemeCode(theme)
    const decoded = await decodeThemeCode(code)
    expect(decoded.ok).toBe(false)
  })
})
