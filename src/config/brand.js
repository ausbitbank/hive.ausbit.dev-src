// Banksia brand constants.
//
// One source of truth for the product name, canonical origin and the legacy
// identifiers that must keep working after the rename. The app is served on
// both banksia.io and the original hive.ausbit.dev host; canonical URLs always
// point at banksia.io while the legacy host remains fully functional.

export const BRAND = Object.freeze({
  name: 'Banksia',
  siteName: 'Banksia',
  domain: 'banksia.io',
  url: 'https://banksia.io',
  legacyHost: 'hive.ausbit.dev',
  legacyUrl: 'https://hive.ausbit.dev',
  tagline: 'Rooted in Hive.',
  description: 'A fast, local-first explorer, wallet and creator toolkit for the Hive blockchain: blocks, accounts, posts, communities, governance, markets, tokens and Lightning.',
  shortDescription: 'A block explorer, wallet and creator toolkit for the Hive blockchain.',
  // New content is published with the Banksia app id. The legacy id is kept
  // readable so existing posts, drafts and imports still round-trip.
  appId: 'banksia.io',
  legacyAppIds: Object.freeze(['hive.ausbit.dev']),
  // Theme metadata has a namespace and a schema. New themes use the Banksia
  // values; readers accept the legacy values so existing profile skins keep
  // rendering.
  themeNamespace: 'banksia.io',
  legacyThemeNamespace: 'hive.ausbit.dev',
  themeSchema: 'banksia.io/theme@1',
  legacyThemeSchema: 'hive.ausbit.dev/theme@1',
  repo: 'ausbitbank/hive.ausbit.dev-src',
  repoUrl: 'https://github.com/ausbitbank/hive.ausbit.dev-src',
  sourceUrl: 'https://github.com/ausbitbank/hive.ausbit.dev-src',
  issueUrl: 'https://github.com/ausbitbank/hive.ausbit.dev-src/issues',
  securityUrl: 'https://github.com/ausbitbank/hive.ausbit.dev-src/security/advisories/new'
})

export const SITE_NAME = BRAND.name
export const SITE_URL = BRAND.url
export const BASE_URL = BRAND.url
export const APP_ID = BRAND.appId
export const THEME_NAMESPACE = BRAND.themeNamespace
export const LEGACY_THEME_NAMESPACE = BRAND.legacyThemeNamespace
export const THEME_SCHEMA = BRAND.themeSchema
export const LEGACY_THEME_SCHEMA = BRAND.legacyThemeSchema
export const LEGACY_HOSTS = Object.freeze([BRAND.legacyHost])
export const DEFAULT_IMAGE = '/statics/og-banksia.png'
