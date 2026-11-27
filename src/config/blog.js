// Blog hosting constants.
//
// A blog is a reading surface for one Hive account (or a curated set of
// accounts). Its settings live in `posting_json_metadata` under the same
// `banksia.io` namespace as the profile theme, so the same posting key can
// claim and edit a blog and there is no server-side configuration database.

export const BLOG_DOMAIN = 'banksia.io'
export const BLOG_APEX_URL = 'https://banksia.io'
export const BLOG_SETTINGS_PATH = '/settings/blog'
export const BLOG_SCHEMA_VERSION = 1

// The blog object shares the 16 KB posting-metadata budget with the profile and
// theme. Blocks and custom CSS make the blog the owner's own site, so it gets a
// larger share than the original bounded theme object.
export const BLOG_MAX_BYTES = 12000
export const BLOG_MAX_BLOCKS = 10
export const BLOG_MAX_CSS = 8000
export const BLOG_MAX_NAV = 6
export const BLOG_MAX_PINNED = 5
export const BLOG_MAX_AUTHORS = 20

// Shop bounds. These are shared by the on-chain settings validator, the
// storefront and the cart so a settings blob cannot ask the UI to render an
// unbounded list.
export const BLOG_MAX_SHOP_FEATURED = 12
export const BLOG_MAX_SHOP_TAGS = 6
export const BLOG_MAX_CART_ITEMS = 20

// Vault (members-only content) bounds and defaults.
//
// `blog.vault` is public advertising metadata: it names the HOM product and the
// hidden grant container. It is small on purpose, because the blog object
// shares the 12 KB budget, and it never carries entitlement or key material.
export const VAULT_SCHEMA_VERSION = 1
export const VAULT_DEFAULT_PRICE = '5.000 HBD'
export const VAULT_DEFAULT_RECURRENCE = 730
export const VAULT_DEFAULT_EXECUTIONS = 12
export const VAULT_DEFAULT_PERIOD = 'month'
export const VAULT_DEFAULT_PRODUCT_PERMLINK = 'membership'
export const VAULT_DEFAULT_CONTAINER = 'banksia-vault'
export const VAULT_MAX_BYTES = 1200
export const VAULT_MAX_BULLETIN_ENTRIES = 300
export const VAULT_MAX_INLINE_CT = 40000
export const VAULT_MAX_PLAINTEXT_INLINE = 30000
export const VAULT_ALLOWED_ARCHIVE = ['all', 'current']

// Labels that must never resolve to an account blog. Some are first-level
// service hosts (`files`, `www`), some are routes the blog itself uses, and
// some are names an impersonation attempt would reach for first.
//
// Kept as one space-separated string: the icon-subset extractor treats every
// bare quoted word in `src` as a possible Material icon name, and several of
// these reserved labels collide with icon names.
const RESERVED_LABELS = 'about abuse admin api app assets auth billing blog ' +
  'cdn contact dashboard demo dev docs download downloads edge feed files ftp ' +
  'git go help imap img images internal legal link links mail media metrics ' +
  'ns1 ns2 origin pay payments pop privacy proxy redirect repo robots rss ' +
  'security sitemap smtp staging static status support terms test www'

export const RESERVED_BLOG_LABELS = Object.freeze(RESERVED_LABELS.split(' '))
