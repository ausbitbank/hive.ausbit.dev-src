import { describe, expect, it } from 'vitest'
import { getTheme } from '../../src/themes/registry'
import {
  mergeThemeMetadata,
  removeThemeMetadata,
  themeFromPostingMetadata
} from '../../src/themes/account'
import { THEME_SCHEMA, validateTheme } from '../../src/themes/schema'

const { overrides: _overrides, ...base } = getTheme('neon-tide')
const theme = {
  ...base,
  schema: THEME_SCHEMA,
  scope: 'profile',
  id: 'test-skin',
  name: 'Test Skin'
}
const legacyTheme = { ...theme, schema: 'hive.ausbit.dev/theme@1' }

describe('theme account metadata', () => {
  it('validates the Banksia schema', () => {
    expect(theme).toBeTruthy()
    const result = validateTheme(theme, { requireProfile: true })
    expect(result.ok).toBe(true)
    expect(result.theme.schema).toBe(THEME_SCHEMA)
  })

  it('accepts a legacy schema and normalises it to the Banksia schema', () => {
    const result = validateTheme(legacyTheme, { requireProfile: true })
    expect(result.ok).toBe(true)
    expect(result.theme.schema).toBe(THEME_SCHEMA)
  })

  it('reads the Banksia namespace', () => {
    const raw = JSON.stringify({ 'banksia.io': { theme } })
    expect(themeFromPostingMetadata(raw).theme.name).toBe('Test Skin')
  })

  it('still reads the legacy namespace', () => {
    const raw = JSON.stringify({ 'hive.ausbit.dev': { theme: legacyTheme } })
    const result = themeFromPostingMetadata(raw)
    expect(result.theme.name).toBe('Test Skin')
    expect(result.theme.schema).toBe(THEME_SCHEMA)
  })

  it('migrates a legacy namespace to Banksia on write and keeps the profile', () => {
    const raw = JSON.stringify({
      profile: { name: 'Alice' },
      'hive.ausbit.dev': { theme: legacyTheme }
    })
    const merged = mergeThemeMetadata(raw, theme)
    expect(merged.ok).toBe(true)
    const value = JSON.parse(merged.text)
    expect(value.profile).toEqual({ name: 'Alice' })
    expect(value['banksia.io'].theme.name).toBe('Test Skin')
    expect(value['hive.ausbit.dev']).toBeUndefined()
  })

  it('removes both namespaces', () => {
    const raw = JSON.stringify({
      'banksia.io': { theme },
      'hive.ausbit.dev': { theme: legacyTheme }
    })
    const removed = removeThemeMetadata(raw)
    expect(removed.ok).toBe(true)
    const value = JSON.parse(removed.text)
    expect(value['banksia.io']).toBeUndefined()
    expect(value['hive.ausbit.dev']).toBeUndefined()
  })
})
