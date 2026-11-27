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
// theme. Keep the blog itself small enough that a long profile still fits.
export const BLOG_MAX_BYTES = 4000
export const BLOG_MAX_NAV = 6
export const BLOG_MAX_PINNED = 5
export const BLOG_MAX_AUTHORS = 20

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
